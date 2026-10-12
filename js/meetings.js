// ======================== MEETINGS & MEETING DETAIL ========================

App.renderMeetings = async function () {
    const meetings = await DB.meetings.orderBy('fecha').reverse().toArray();
    const h = document.getElementById('meetings-list');
    if (!meetings.length) {
        h.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F4C4;</div><p>' + App._t('meetings.empty') + '</p></div>';
        return;
    }
    const tipoLabels = { Ordinaria: App._t('meetings.tipoOrdinaria'), Extraordinaria: App._t('meetings.tipoExtraordinaria'), Especial: App._t('meetings.tipoEspecial'), Comisi\u00f3n: App._t('meetings.tipoComision') };
    h.innerHTML = meetings.map(m => {
        const fecha = new Date(m.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const tipo = m.tipo || 'Ordinaria';
        const tipoColors = { Ordinaria: '#1e1b4b,#a5b4fc', Extraordinaria: '#4a0e2b,#f9a8d4', Especial: '#451a03,#fbbf24', Comisi\u00f3n: '#064e3b,#6ee7b7' };
        const tc = (tipoColors[tipo] || '#1e1b4b,#a5b4fc').split(',');
        const tipoBadge = `<span class="item-badge" style="background:${tc[0]};color:${tc[1]};">${tipoLabels[tipo] || tipo}</span>`;
        return `
        <div class="list-item" onclick="App.navTo('meeting-detail', ${m.id})" style="cursor:pointer">
            <div class="item-main">
                <div class="item-title">${App.esc(m.titulo)} ${tipoBadge}</div>
                <div class="item-sub">${fecha}${m.notas ? ' &middot; ' + App.esc(m.notas.substring(0, 60)) : ''}</div>
            </div>
            <div class="item-actions">
                <span class="item-badge badge-pending">${App._t('meetings.detailBadge')}</span>
            </div>
        </div>`;
    }).join('');
};

App.showMeetingForm = async function (id) {
    const today = new Date().toISOString().split('T')[0];
    let data = { titulo: '', fecha: today, notas: '', tipo: 'Ordinaria' };
    let isEdit = false;
    if (id) {
        data = await DB.meetings.get(id);
        isEdit = true;
    }
    const tipoOptLabels = { Ordinaria: App._t('meetings.tipoOrdinaria'), Extraordinaria: App._t('meetings.tipoExtraordinaria'), Especial: App._t('meetings.tipoEspecial'), Comisi\u00f3n: App._t('meetings.tipoComision') };
    const tipoOptions = ['Ordinaria', 'Extraordinaria', 'Especial', 'Comisi\u00f3n']
        .map(t => `<option value="${t}" ${data.tipo === t ? 'selected' : ''}>${tipoOptLabels[t]}</option>`).join('');
    App.showModal(
        isEdit ? App._t('meetings.editTitle') : App._t('meetings.newTitle'),
        `<div class="form-group">
            <label>${App._t('meetings.titleLabel')}</label>
            <input id="f-meeting-title" value="${App.esc(data.titulo)}" placeholder="${App._t('meetings.titlePlaceholder')}" />
        </div>
        <div class="form-group">
            <label>${App._t('meetings.dateLabel')}</label>
            <input id="f-meeting-date" type="date" value="${data.fecha}" />
        </div>
        <div class="form-group">
            <label>${App._t('meetings.tipoLabel')}</label>
            <select id="f-meeting-tipo">${tipoOptions}</select>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
                ${App._t('meetings.tipoHelp')}
            </div>
        </div>
        <div class="form-group">
            <label>${App._t('meetings.notesLabel')}</label>
            <textarea id="f-meeting-notes" placeholder="Opcional">${App.esc(data.notas || '')}</textarea>
        </div>`,
        `<button class="btn secondary" onclick="App.closeModal()">${App._t('common.cancel')}</button>
         <button class="btn primary" onclick="App.saveMeetingForm(${isEdit ? id : null})">${isEdit ? App._t('common.save') : App._t('meetings.createBtn')}</button>`
    );
    if (id) App.editingId = id;
    // TomSelect on tipo selector
    const selTipo = document.getElementById('f-meeting-tipo');
    if (selTipo) App._tsMeetingTipo = new TomSelect(selTipo, { maxOptions: 10 });
};

App.saveMeetingForm = async function (editId) {
    const titulo = document.getElementById('f-meeting-title').value.trim();
    if (!titulo) return App.alert(App._t('errors.required'), App._t('meetings.titleRequired'), 'warning');
    let tipo = document.getElementById('f-meeting-tipo').value;
    if (App._tsMeetingTipo) tipo = App._tsMeetingTipo.getValue();
    const data = {
        titulo,
        fecha: document.getElementById('f-meeting-date').value,
        tipo: tipo || 'Ordinaria',
        notas: document.getElementById('f-meeting-notes').value.trim()
    };
    let id;
    if (editId) {
        await DB.meetings.update(editId, data);
        id = editId;
    } else {
        id = await DB.meetings.add(data);
    }
    if (App._tsMeetingTipo) { App._tsMeetingTipo.destroy(); App._tsMeetingTipo = null; }
    App.closeModal();
    App.editingId = null;
    App.renderMeetings();
    App.renderHome();
    App.navTo('meeting-detail', id);
};

App.deleteMeeting = async function () {
    if (!App.currentMeetingId) return;
    const ok = await App.confirm(App._t('meetings.deleteConfirm'), App._t('meetings.deleteText'));
    if (!ok) return;
    await DB.meetings.delete(App.currentMeetingId);
    await DB.attendance.where('meetingId').equals(App.currentMeetingId).delete();
    await DB.topics.where('meetingId').equals(App.currentMeetingId).delete();
    App.currentMeetingId = null;
    App.navTo('meetings');
    App.renderHome();
};

App.renderMeetingDetail = async function (id) {
    App.currentMeetingId = id;
    const meeting = await DB.meetings.get(id);
    if (!meeting) return App.navTo('meetings');

    const tipo = meeting.tipo || 'Ordinaria';
    const isGroupType = tipo !== 'Especial';

    const groups = await DB.groups.toArray();
    const contacts = await DB.contacts.toArray();
    const cgRows = await DB.contact_groups.toArray();
    const attendance = await DB.attendance.where('meetingId').equals(id).toArray();
    const topics = await DB.topics.where('meetingId').equals(id).toArray();
    const pendingTopics = await DB.topics.where('resuelto').equals(0).filter(t => t.meetingId != id).toArray();

    const groupMap = {};
    groups.forEach(g => groupMap[g.id] = g.nombre);

    const cgMap = {};
    cgRows.forEach(cg => {
        if (!cgMap[cg.contactId]) cgMap[cg.contactId] = [];
        cgMap[cg.contactId].push(cg.groupId);
    });

    const attMap = {};
    attendance.forEach(a => {
        attMap[a.contactId + '_' + (a.groupId || '')] = a;
    });

    const fecha = new Date(meeting.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const tipoLabels = { Ordinaria: App._t('meetings.tipoOrdinaria'), Extraordinaria: App._t('meetings.tipoExtraordinaria'), Especial: App._t('meetings.tipoEspecial'), Comisi\u00f3n: App._t('meetings.tipoComision') };
    const tipoColors = { Ordinaria: '#1e1b4b,#a5b4fc', Extraordinaria: '#4a0e2b,#f9a8d4', Especial: '#451a03,#fbbf24', Comisi\u00f3n: '#064e3b,#6ee7b7' };
    const tc = (tipoColors[tipo] || '#1e1b4b,#a5b4fc').split(',');

    let attendanceHtml = '';

    if (isGroupType) {
        // ===== GROUP MODE: ALL groups, each with members =====
        if (!groups.length) {
            attendanceHtml = '<p style="color:var(--text-secondary);font-size:14px;">' + App._t('meetings.noGroups') + '</p>';
        } else {
            attendanceHtml = '<div style="margin-bottom:12px;">';
            for (const g of groups) {
                const groupContacts = contacts.filter(c => {
                    const cgs = cgMap[c.id] || [];
                    return cgs.includes(g.id);
                });
                const groupAttRecords = attendance.filter(a => a.groupId == g.id);
                const anyPresent = groupAttRecords.some(a => a.asistio);
                const hasAviso = groupAttRecords.some(a => a.avisoAusencia);
                const groupMotivo = groupAttRecords.length > 0 ? (groupAttRecords[0].motivo || '') : '';

                // Only show attendees (asistio == true), not all members
                const attendees = groupContacts.filter(c => {
                    const key = c.id + '_' + g.id;
                    return attMap[key] && attMap[key].asistio;
                });
                const attendeeTags = attendees.map(c => `
                    <span class="attendee-tag">
                        ${App.esc(c.nombre)}
                        <span class="attendee-remove" onclick="App.removeGroupAttendee(${id},${c.id},${g.id})">&times;</span>
                    </span>
                `).join('');

                // Members NOT yet attending (for the add button)
                const nonAttendeeIds = new Set(groupContacts.map(c => c.id));
                attendees.forEach(c => nonAttendeeIds.delete(c.id));
                const nonAttendees = groupContacts.filter(c => nonAttendeeIds.has(c.id));
                const addOptions = nonAttendees.map(c =>
                    `<option value="${c.id}">${App.esc(c.nombre)}</option>`
                ).join('');

                const absentForm = `
                    <div class="group-att-absent">
                        <label>
                            <input type="checkbox" id="gaviso-${g.id}" ${hasAviso && !anyPresent ? 'checked' : ''} onchange="App.toggleGroupAbsence(${id},${g.id})" />
                            ${App._t('meetings.warned')}
                        </label>
                        <input type="text" id="gmotivo-${g.id}" value="${App.esc(groupMotivo)}" placeholder="${App._t('meetings.reasonPlaceholder')}" onchange="App.setGroupMotivo(${id},${g.id})" />
                    </div>`;

                const badgeClass = anyPresent ? 'badge-resolved' : (groupAttRecords.length ? 'badge-pending' : 'badge-group');
                const badgeText = anyPresent ? App._t('meetings.present') : (groupAttRecords.length ? App._t('meetings.absent') : App._t('meetings.pending'));

                attendanceHtml += `
                    <div class="group-att-row" onclick="App.toggleGroupAttExpand(${g.id})">
                        <input type="checkbox" class="gatt-toggle" id="gatt-${g.id}" ${anyPresent ? 'checked' : ''} onclick="event.stopPropagation(); App.toggleGroupAttendance(${id},${g.id})" />
                        <span class="gatt-name">${App.esc(g.nombre)}</span>
                        <span class="item-badge ${badgeClass} gatt-badge">${badgeText}</span>
                        <span class="gatt-expand">&#x25BC;</span>
                    </div>
                    <div class="group-att-detail ${groupAttRecords.length ? 'open' : ''}" id="gatt-detail-${g.id}">
                        <div id="gatt-members-${g.id}" ${anyPresent ? '' : 'style="display:none;"'}>
                            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">${App._t('meetings.attendees')}</div>
                            <div class="group-att-members">${attendeeTags || '<span style="font-size:12px;color:var(--text-secondary);">' + App._t('meetings.noAttendees') + '</span>'}</div>
                            ${nonAttendees.length ? `
                            <div class="group-att-add">
                                <small style="color:var(--text-secondary);">${App._t('meetings.addAttendee')}</small>
                                <select class="gatt-add-select" onchange="App.addGroupAttendee(${id},${g.id},this)">
                                    <option value="">${App._t('meetings.select')}</option>
                                    ${addOptions}
                                </select>
                            </div>` : ''}
                        </div>
                        <div id="gatt-absent-${g.id}" ${anyPresent ? 'style="display:none;"' : ''}>${absentForm}</div>
                    </div>`;
            }
            attendanceHtml += '<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">' + App._t('meetings.groupHelp') + '</p>';
            attendanceHtml += '</div>';

            // ===== Individual contacts (no group) =====
            const individualContacts = contacts.filter(c => {
                const cgs = cgMap[c.id] || [];
                return cgs.length === 0;
            });
            if (individualContacts.length) {
                attendanceHtml += '<div class="section-title" style="margin-top:20px;">&#x1F464; ' + App._t('meetings.indContacts') + '</div>';
                attendanceHtml += '<div class="checkbox-group">';
                for (const c of individualContacts) {
                    const key = c.id + '_';
                    const a = attMap[key] || { asistio: false, avisoAusencia: false, motivo: '' };
                    attendanceHtml += `
                        <div class="checkbox-item">
                            <input type="checkbox" id="att-${c.id}" ${a.asistio ? 'checked' : ''} onchange="App.toggleIndAttendance(${id},${c.id})" />
                            <label for="att-${c.id}"><strong>${App.esc(c.nombre)}</strong></label>
                            <span class="att-extra">
                                <span>${App._t('meetings.warnedLabel')}</span>
                                <input type="checkbox" id="aviso-${c.id}" ${a.avisoAusencia ? 'checked' : ''} onchange="App.toggleIndAviso(${id},${c.id})" />
                                <input type="text" id="motivo-${c.id}" value="${App.esc(a.motivo || '')}" placeholder="${App._t('meetings.reasonPlaceholder')}" onchange="App.setIndMotivo(${id},${c.id})" />
                            </span>
                        </div>`;
                }
                attendanceHtml += '</div>';
            }
        }
    } else {
        // ===== INDIVIDUAL MODE: ALL contacts (regardless of group) =====
        attendanceHtml = '<div class="checkbox-group">';
        for (const c of contacts) {
            const key = c.id + '_';
            const a = attMap[key] || { asistio: false, avisoAusencia: false, motivo: '' };
            const groupNames = (cgMap[c.id] || []).map(gid => groupMap[gid]).filter(Boolean).join(', ');
            attendanceHtml += `
                <div class="checkbox-item">
                    <input type="checkbox" id="att-${c.id}" ${a.asistio ? 'checked' : ''} onchange="App.toggleIndAttendance(${id},${c.id})" />
                    <label for="att-${c.id}">
                        <strong>${App.esc(c.nombre)}</strong>
                        ${groupNames ? '<span style="font-weight:400;color:var(--text-secondary);font-size:12px;"> &middot; ' + App.esc(groupNames) + '</span>' : ''}
                    </label>
                    <span class="att-extra">
                        <span>${App._t('meetings.warnedLabel')}</span>
                        <input type="checkbox" id="aviso-${c.id}" ${a.avisoAusencia ? 'checked' : ''} onchange="App.toggleIndAviso(${id},${c.id})" />
                        <input type="text" id="motivo-${c.id}" value="${App.esc(a.motivo || '')}" placeholder="${App._t('meetings.reasonPlaceholder')}" onchange="App.setIndMotivo(${id},${c.id})" />
                    </span>
                </div>`;
        }
        attendanceHtml += '</div>';
    }

    // ===== TOPICS =====
    let pendHtml = '';
    if (pendingTopics.length) {
        pendHtml = pendingTopics.map(t => `
            <div class="topic-item">
                <div class="topic-header">
                    <span class="topic-title">${App.esc(t.titulo)}</span>
                    <span class="item-badge ${t.resuelto ? 'badge-resolved' : 'badge-pending'}">${t.resuelto ? App._t('topics.resolved') : App._t('topics.pending')}</span>
                </div>
                <div class="topic-summary">${t.resumen ? App.esc(t.resumen) : '<em>' + App._t('topics.noSummary') + '</em>'}</div>
                ${t.comentario ? '<div style="font-size:12px;color:var(--text-secondary);margin:4px 0;"><em>\u2192 ' + App.esc(t.comentario) + '</em></div>' : ''}
                <div class="topic-actions">
                    <button class="btn success small" onclick="App.copyToMeeting(${id},${t.id})">${App._t('topics.copyToMeeting')}</button>
                </div>
            </div>
        `).join('');
    } else {
        pendHtml = '<p style="color:var(--text-secondary);font-size:14px;">' + App._t('topics.noPending') + '</p>';
    }

    let topicsHtml = '';
    if (topics.length) {
        topicsHtml = topics.map(t => {
            let historial = [];
            try { historial = JSON.parse(t.historial || '[]'); } catch (e) {}
            const historialHtml = historial.length ? `
                <div class="topic-history" onclick="this.classList.toggle('open')">
                    <span class="topic-history-toggle">${App._t('topics.historialTitle')} (${historial.length})</span>
                    <div class="topic-history-content">
                        ${historial.map(h => {
                            const fechaStr = h.fecha ? new Date(h.fecha).toLocaleDateString(App._lang === 'eu' ? 'eu-ES' : 'es-ES') : '';
                            const enc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                            return `<div class="topic-history-entry" style="cursor:pointer;" onclick="event.stopPropagation();App.showMeetingSummary(${h.meetingId},'${enc(h.comentario)}')" title="${App._t('meetings.viewSummary')}">
                                <strong>${App.esc(h.meetingTitulo)}</strong>${fechaStr ? ' (' + fechaStr + ')' : ''}
                                ${h.comentario ? '<br><em>' + App.esc(h.comentario) + '</em>' : ''}
                            </div>`;
                        }).join('')}
                    </div>
                </div>` : '';
            return `
            <div class="topic-item">
                <div class="topic-header">
                    <span class="topic-title">${App.esc(t.titulo)}</span>
                    <span class="item-badge ${t.resuelto ? 'badge-resolved' : 'badge-pending'}">${t.resuelto ? App._t('topics.resolved') : App._t('topics.pending')}</span>
                </div>
                <div class="topic-summary">${t.resumen ? App.esc(t.resumen) : '<em>' + App._t('topics.noSummary') + '</em>'}</div>
                ${t.comentario ? '<div style="font-size:12px;color:var(--text-secondary);margin:4px 0;padding:6px 8px;background:#000000;border-radius:4px;border:1px solid #1a1a1a;"><em>' + App.esc(t.comentario) + '</em></div>' : ''}
                ${t.resuelto && t.solucion ? '<div class="topic-solucion">\u2713 ' + App.esc(t.solucion) + '</div>' : ''}
                ${historialHtml}
                <div class="topic-actions">
                    <button class="btn secondary small" onclick="App.editTopic(${t.id})">${App._t('common.edit')}</button>
                    <button class="btn ${t.resuelto ? 'warning' : 'success'} small" onclick="App.toggleResolved(${t.id})">
                        ${t.resuelto ? App._t('topics.togglePending') : App._t('topics.toggleResolved')}
                    </button>
                    <button class="btn danger small" onclick="App.deleteTopic(${t.id})">${App._t('common.delete')}</button>
                </div>
            </div>`;
        }).join('');
    } else {
        topicsHtml = '<p style="color:var(--text-secondary);font-size:14px;">' + App._t('topics.noMeetingTopics') + '</p>';
    }

    const h = document.getElementById('meeting-detail');
    h.innerHTML = `
        <div class="meeting-info">
            <h2>${App.esc(meeting.titulo)}</h2>
            <div class="meta">
                ${fecha}
                <span class="item-badge" style="background:${tc[0]};color:${tc[1]};">${tipoLabels[tipo] || tipo}</span>
                ${meeting.notas ? ' &middot; ' + App.esc(meeting.notas) : ''}
            </div>
        </div>

        <div class="section-title">${isGroupType ? '&#x1F465; ' + App._t('meetings.groupAttendance') : '&#x1F464; ' + App._t('meetings.indAttendance')}</div>
        ${attendanceHtml}

        <div class="section-title">&#x1F504; ${App._t('topics.pendingTopics')}</div>
        ${pendHtml}

        <div class="section-title">&#x1F4DD; ${App._t('topics.meetingTopics')}
            <button class="btn primary small" onclick="App.addTopic(${id})">${App._t('topics.addTopic')}</button>
        </div>
        ${topicsHtml}

        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn success" onclick="App.saveMeetingPdf(${id})">&#x1F4E4; ${App._t('meetings.exportPDF')}</button>
        </div>
    `;
};

// ===== GROUP ATTENDANCE TOGGLES =====
App.toggleGroupAttExpand = function (groupId) {
    const detail = document.getElementById('gatt-detail-' + groupId);
    if (!detail) return;
    detail.classList.toggle('open');
    const expand = detail.previousElementSibling.querySelector('.gatt-expand');
    if (expand) expand.classList.toggle('open');
};

App.toggleGroupAttendance = async function (meetingId, groupId) {
    const checked = document.getElementById('gatt-' + groupId).checked;
    const detail = document.getElementById('gatt-detail-' + groupId);
    const membersDiv = document.getElementById('gatt-members-' + groupId);
    const absentDiv = document.getElementById('gatt-absent-' + groupId);
    if (detail) detail.classList.add('open');
    if (membersDiv) membersDiv.style.display = checked ? '' : 'none';
    if (absentDiv) absentDiv.style.display = checked ? 'none' : '';
    const row = document.getElementById('gatt-' + groupId).closest('.group-att-row');
    if (row) {
        const badge = row.querySelector('.gatt-badge');
        if (badge) {
            if (checked) { badge.className = 'item-badge badge-resolved gatt-badge'; badge.textContent = App._t('meetings.present'); }
            else { badge.className = 'item-badge badge-pending gatt-badge'; badge.textContent = App._t('meetings.absent'); }
        }
    }
    if (!checked) {
        const records = await DB.attendance.where({ meetingId, groupId }).toArray();
        for (const r of records) await DB.attendance.delete(r.id);
    }
};

App.addGroupAttendee = async function (meetingId, groupId, selectEl) {
    const contactId = parseInt(selectEl.value);
    if (!contactId) return;
    selectEl.value = '';
    let record = await DB.attendance.where({ meetingId, contactId, groupId }).first();
    if (!record) {
        await DB.attendance.add({ meetingId, contactId, groupId, asistio: true, avisoAusencia: false, motivo: '' });
    } else if (!record.asistio) {
        await DB.attendance.update(record.id, { asistio: true, avisoAusencia: false, motivo: '' });
    }
    App.renderMeetingDetail(meetingId);
};

App.removeGroupAttendee = async function (meetingId, contactId, groupId) {
    const record = await DB.attendance.where({ meetingId, contactId, groupId }).first();
    if (record) {
        await DB.attendance.update(record.id, { asistio: false, motivo: '' });
    }
    App.renderMeetingDetail(meetingId);
};

App.toggleGroupAbsence = async function (meetingId, groupId) {
    const avisoChecked = document.getElementById('gaviso-' + groupId).checked;
    const existing = await DB.attendance.where({ meetingId, groupId }).filter(a => !a.asistio).first();
    if (existing) await DB.attendance.update(existing.id, { avisoAusencia: avisoChecked });
    else await DB.attendance.add({ meetingId, contactId: null, groupId, asistio: false, avisoAusencia: avisoChecked, motivo: '' });
};

App.setGroupMotivo = async function (meetingId, groupId) {
    const motivo = document.getElementById('gmotivo-' + groupId).value.trim();
    const existing = await DB.attendance.where({ meetingId, groupId }).filter(a => !a.asistio).first();
    if (existing) await DB.attendance.update(existing.id, { motivo });
    else await DB.attendance.add({ meetingId, contactId: null, groupId, asistio: false, avisoAusencia: false, motivo });
};

// ===== INDIVIDUAL ATTENDANCE =====
App.toggleIndAttendance = async function (meetingId, contactId) {
    const checked = document.getElementById('att-' + contactId).checked;
    let record = await DB.attendance.where({ meetingId, contactId }).filter(a => !a.groupId).first();
    if (!record) {
        record = { meetingId, contactId, groupId: null, asistio: false, avisoAusencia: false, motivo: '' };
    }
    record.asistio = checked;
    if (checked) {
        record.avisoAusencia = false; record.motivo = '';
        const aviso = document.getElementById('aviso-' + contactId);
        const motivo = document.getElementById('motivo-' + contactId);
        if (aviso) aviso.checked = false;
        if (motivo) motivo.value = '';
    }
    if (record.id) await DB.attendance.update(record.id, record);
    else await DB.attendance.add(record);
};

App.toggleIndAviso = async function (meetingId, contactId) {
    const checked = document.getElementById('aviso-' + contactId).checked;
    let record = await DB.attendance.where({ meetingId, contactId }).filter(a => !a.groupId).first();
    if (!record) {
        record = { meetingId, contactId, groupId: null, asistio: false, avisoAusencia: false, motivo: '' };
    }
    record.avisoAusencia = checked;
    if (record.id) await DB.attendance.update(record.id, record);
    else await DB.attendance.add(record);
};

App.setIndMotivo = async function (meetingId, contactId) {
    const motivo = document.getElementById('motivo-' + contactId).value.trim();
    let record = await DB.attendance.where({ meetingId, contactId }).filter(a => !a.groupId).first();
    if (!record) {
        record = { meetingId, contactId, groupId: null, asistio: false, avisoAusencia: false, motivo };
        await DB.attendance.add(record);
    } else {
        await DB.attendance.update(record.id, { motivo });
    }
};

App.showMeetingSummary = async function (meetingId, comentario) {
    const meeting = await DB.meetings.get(meetingId);
    if (!meeting) return;
    const topics = await DB.topics.where('meetingId').equals(meetingId).toArray();
    const attRows = await DB.attendance.where('meetingId').equals(meetingId).toArray();
    const contacts = await DB.contacts.toArray();
    const contactMap = {};
    contacts.forEach(c => contactMap[c.id] = c.nombre);

    const fecha = new Date(meeting.fecha).toLocaleDateString(App._lang === 'eu' ? 'eu-ES' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const tipoLabels = { Ordinaria: App._t('meetings.tipoOrdinaria'), Extraordinaria: App._t('meetings.tipoExtraordinaria'), Especial: App._t('meetings.tipoEspecial'), Comisi\u00f3n: App._t('meetings.tipoComision') };
    const tipo = meeting.tipo || 'Ordinaria';
    const attendees = attRows.filter(a => a.asistio).map(a => contactMap[a.contactId]).filter(Boolean);

    App.showModal(
        App.esc(meeting.titulo),
        `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
            ${fecha} &middot; <span class="item-badge" style="background:#1e1b4b;color:#a5b4fc;">${tipoLabels[tipo] || tipo}</span>
        </div>
        ${meeting.notas ? '<div style="margin-bottom:10px;padding:8px 10px;background:#000000;border-radius:6px;border:1px solid #1a1a1a;font-size:13px;color:var(--text);"><strong>' + App._t('meetings.notesLabel') + ':</strong> ' + App.esc(meeting.notas) + '</div>' : ''}
        <div style="margin-bottom:8px;font-size:13px;font-weight:600;">${App._t('meetingSummary.topics')} (${topics.length})</div>
        ${topics.length ? '<div style="margin-bottom:10px;">' + topics.map(t =>
            `<div style="padding:6px 8px;background:#000000;border-radius:4px;margin-bottom:4px;border:1px solid #1a1a1a;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
                <span>${App.esc(t.titulo)}</span>
                <span class="item-badge ${t.resuelto ? 'badge-resolved' : 'badge-pending'}" style="flex-shrink:0;">${t.resuelto ? App._t('topics.resolved') : App._t('topics.pending')}</span>
            </div>`
        ).join('') : '<p style="font-size:13px;color:var(--text-secondary);">' + App._t('pdf.noTopics') + '</p>'}
        <div style="margin-top:10px;font-size:13px;color:var(--text-secondary);">
            <strong>${App._t('meetingSummary.attended')}:</strong> ${attendees.length > 0 ? attendees.join(', ') : '0'}
        </div>`,
        `<button class="btn secondary" onclick="App.closeModal()">${App._t('common.close')}</button>
         <button class="btn primary" onclick="App.closeModal();App.navTo('meeting-detail',${meetingId})">${App._t('meetingSummary.goToMeeting')}</button>`
    );
};
