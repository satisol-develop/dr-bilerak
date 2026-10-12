// ======================== GROUPS ========================

App.renderGroups = async function () {
    const groups = await DB.groups.toArray();
    const h = document.getElementById('groups-list');
    if (!groups.length) {
        h.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F465;</div><p>' + App._t('groups.empty') + '</p></div>';
        return;
    }
    const cgRows = await DB.contact_groups.toArray();
    h.innerHTML = groups.map(g => {
        const memberIds = new Set(cgRows.filter(cg => cg.groupId == g.id).map(cg => cg.contactId));
        const miembros = memberIds.size;
        const activo = g.activo !== false;
        const activoBadge = activo ? '' : '<span class="item-badge badge-pending" style="margin-left:6px;">' + App._t('groups.disabled') + '</span>';
        return `
        <div class="list-item" style="${activo ? '' : 'opacity:0.7;'}">
            <div class="item-main">
                <div class="item-title">${App.esc(g.nombre)}${activoBadge}</div>
                <div class="item-sub">${miembros} ${App._t('groups.members')}</div>
            </div>
            <div class="item-actions">
                <button class="btn secondary small" onclick="App.showGroupForm(${g.id})">${App._t('common.edit')}</button>
                <button class="btn ${activo ? 'warning' : 'success'} small" onclick="App.toggleGroupActive(${g.id})">${activo ? App._t('groups.disable') : App._t('groups.enable')}</button>
                <button class="btn danger small" onclick="App.deleteGroup(${g.id})">${App._t('common.delete')}</button>
            </div>
        </div>`;
    }).join('');
};

App.showGroupForm = async function (id) {
    App.editingId = id || null;
    let data = { nombre: '' };
    if (id) data = await DB.groups.get(id);
    App.showModal(
        id ? App._t('groups.editTitle') : App._t('groups.newTitle'),
        `<div class="form-group">
            <label>${App._t('groups.nameLabel')}</label>
            <input id="f-group-name" value="${App.esc(data.nombre)}" placeholder="${App._t('groups.namePlaceholder')}" />
        </div>`,
        `         <button class="btn secondary" onclick="App.closeModal()">${App._t('common.cancel')}</button>
                   <button class="btn primary" onclick="App.saveGroup()">${App._t('common.save')}</button>`
    );
};

App.saveGroup = async function () {
    const nombre = document.getElementById('f-group-name').value.trim();
    if (!nombre) return App.alert(App._t('errors.required'), App._t('groups.nameRequired'), 'warning');
    if (App.editingId) {
        await DB.groups.update(App.editingId, { nombre });
    } else {
        await DB.groups.add({ nombre });
    }
    App.closeModal();
    App.renderGroups();
    App.renderHome();
};

App.toggleGroupActive = async function (id) {
    const group = await DB.groups.get(id);
    if (!group) return;
    const activo = group.activo !== false;
    if (activo) {
        const ok = await App.confirm(App._t('groups.disableConfirm'), App._t('groups.disableText'));
        if (!ok) return;
    }
    await DB.groups.update(id, { activo: activo ? 0 : 1 });
    App.renderGroups();
};

App.deleteGroup = async function (id) {
    const ok = await App.confirm(App._t('groups.deleteConfirm'), App._t('groups.deleteText'));
    if (!ok) return;
    // Remove group memberships
    await DB.contact_groups.where('groupId').equals(id).delete();
    await DB.groups.delete(id);
    App.renderGroups();
    App.renderHome();
    App.renderContacts();
};
