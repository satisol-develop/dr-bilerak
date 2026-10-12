// ======================== CONTACTS ========================

App.renderContacts = async function () {
    const contacts = await DB.contacts.toArray();
    const groups = await DB.groups.toArray();
    const cgRows = await DB.contact_groups.toArray();
    const filterGroup = document.getElementById('filter-group').value;
    const groupMap = {};
    groups.forEach(g => groupMap[g.id] = g.nombre);

    const cgMap = {};
    cgRows.forEach(cg => {
        if (!cgMap[cg.contactId]) cgMap[cg.contactId] = [];
        cgMap[cg.contactId].push(cg.groupId);
    });

    let filtered = contacts;
    if (filterGroup) {
        filtered = filtered.filter(c => {
            const groups = cgMap[c.id] || [];
            return groups.includes(parseInt(filterGroup));
        });
    }

    const sel = document.getElementById('filter-group');
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">${App._t('contacts.filterAll')}</option>` +
        groups.map(g => `<option value="${g.id}">${App.esc(g.nombre)}</option>`).join('');
    sel.value = currentVal;

    const h = document.getElementById('contacts-list');
    if (!filtered.length) {
        h.innerHTML = `<div class="empty-state"><div class="empty-icon">&#x1F464;</div><p>${App._t('contacts.empty')}</p></div>`;
        return;
    }
    h.innerHTML = filtered.map(c => {
        const contactGroupIds = cgMap[c.id] || [];
        const groupNames = contactGroupIds.map(gid => groupMap[gid]).filter(Boolean);
        const label = groupNames.length ? groupNames.join(', ') : App._t('contacts.individual');
        return `
        <div class="list-item">
            <div class="item-main">
                <div class="item-title">${App.esc(c.nombre)}</div>
                <div class="item-sub">
                    <span class="item-badge badge-group">${App.esc(label)}</span>
                    ${c.telefono ? ' &middot; ' + App.esc(c.telefono) : ''}
                    ${c.email ? ' &middot; ' + App.esc(c.email) : ''}
                </div>
            </div>
            <div class="item-actions">
                <button class="btn secondary small" onclick="App.showContactForm(${c.id})">${App._t('common.edit')}</button>
                <button class="btn danger small" onclick="App.deleteContact(${c.id})">${App._t('common.delete')}</button>
            </div>
        </div>`;
    }).join('');
};

App.showContactForm = async function (id) {
    App.editingId = id || null;
    const groups = await DB.groups.toArray();
    const cgRows = await DB.contact_groups.toArray();
    let data = { nombre: '', telefono: '', email: '' };
    let contactGroupIds = [];
    if (id) {
        data = await DB.contacts.get(id);
        contactGroupIds = cgRows.filter(cg => cg.contactId == id).map(cg => cg.groupId);
    }

    const groupOptions = groups.map(g =>
        `<option value="${g.id}" ${contactGroupIds.includes(g.id) ? 'selected' : ''}>${App.esc(g.nombre)}</option>`
    ).join('');

    App.showModal(
        id ? App._t('contacts.editTitle') : App._t('contacts.newTitle'),
        `<div class="form-group">
            <label>${App._t('contacts.nameLabel')}</label>
            <input id="f-contact-name" value="${App.esc(data.nombre)}" placeholder="${App._t('contacts.namePlaceholder')}" />
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>${App._t('contacts.phoneLabel')}</label>
                <input id="f-contact-phone" value="${App.esc(data.telefono || '')}" placeholder="Opcional" />
            </div>
            <div class="form-group">
                <label>${App._t('contacts.emailLabel')}</label>
                <input id="f-contact-email" value="${App.esc(data.email || '')}" placeholder="Opcional" />
            </div>
        </div>
        <div class="form-group">
            <label>${App._t('contacts.groupsLabel')}</label>
            ${groups.length ? '<select id="f-contact-groups" multiple placeholder="Seleccionar agrupaciones..." style="width:100%;">' + groupOptions + '</select>' : `<p style="font-size:13px;color:var(--text-secondary);">${App._t('contacts.noGroups')}</p>`}
        </div>`,
        `<button class="btn secondary" onclick="App.closeModal()">${App._t('common.cancel')}</button>
         <button class="btn primary" onclick="App.saveContact()">${App._t('common.save')}</button>`
    );

    // Init TomSelect on the multi-select after modal is rendered
    const selEl = document.getElementById('f-contact-groups');
    if (selEl) {
        App._tsContactGroups = new TomSelect(selEl, {
            plugins: ['remove_button'],
            maxOptions: 20
        });
    }
};

App.saveContact = async function () {
    const nombre = document.getElementById('f-contact-name').value.trim();
    if (!nombre) return App.alert(App._t('errors.required'), App._t('contacts.nameRequired'), 'warning');
    const data = {
        nombre,
        telefono: document.getElementById('f-contact-phone').value.trim(),
        email: document.getElementById('f-contact-email').value.trim()
    };
    const selectedGroups = [];
    const ts = App._tsContactGroups;
    if (ts) {
        selectedGroups.push(...ts.getValue().map(v => parseInt(v)));
    } else {
        document.querySelectorAll('.cg-checkbox:checked').forEach(cb => {
            selectedGroups.push(parseInt(cb.value));
        });
    }

    if (App.editingId) {
        await DB.contacts.update(App.editingId, data);
        await DB.contact_groups.where('contactId').equals(App.editingId).delete();
        for (const gid of selectedGroups) {
            await DB.contact_groups.add({ contactId: App.editingId, groupId: gid });
        }
    } else {
        const cid = await DB.contacts.add(data);
        for (const gid of selectedGroups) {
            await DB.contact_groups.add({ contactId: cid, groupId: gid });
        }
    }
    App.closeModal();
    App.renderContacts();
    App.renderHome();
};

App.deleteContact = async function (id) {
    const ok = await App.confirm(App._t('contacts.deleteConfirm'), App._t('contacts.deleteText'));
    if (!ok) return;
    await DB.contacts.delete(id);
    await DB.attendance.where('contactId').equals(id).delete();
    await DB.contact_groups.where('contactId').equals(id).delete();
    App.renderContacts();
    App.renderMeetings();
    App.renderHome();
};
