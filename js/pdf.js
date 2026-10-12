// ======================== PDF ========================

App.generatePDF = async function (meetingId) {
    const meeting = await DB.meetings.get(meetingId);
    if (!meeting) return App.alert('Error', 'Acta no encontrada.', 'error');
    const topics = await DB.topics.where('meetingId').equals(meetingId).toArray();
    const attRows = await DB.attendance.where('meetingId').equals(meetingId).toArray();
    const contacts = await DB.contacts.toArray();
    const groups = await DB.groups.toArray();
    const cgRows = await DB.contact_groups.toArray();

    const contactMap = {};
    contacts.forEach(c => contactMap[c.id] = c.nombre);
    const groupMap = {};
    groups.forEach(g => groupMap[g.id] = g.nombre);

    const isGroupType = (meeting.tipo || 'Ordinaria') !== 'Especial';

    function li(text, cls) {
        return '<li' + (cls ? ' class="' + cls + '"' : '') + '>' + text + '</li>';
    }

    let groupHtml = '';
    let indHtml = '';

    if (isGroupType) {
        // ===== GROUP-TYPE MEETINGS =====
        const groupEntries = attRows.filter(a => !a.contactId && a.groupId);
        if (groupEntries.length) {
            const presentes = groupEntries.filter(a => a.asistio);
            const ausentes = groupEntries.filter(a => !a.asistio);

            let lists = '';
            if (presentes.length) {
                lists += '<h3>' + App._t('pdf.presentGroups') + '</h3><ul>';
                for (const pe of presentes) {
                    const gName = groupMap[pe.groupId];
                    if (!gName) continue;
                    // Members of this group who attended
                    const memberIds = attRows.filter(a => a.groupId === pe.groupId && a.contactId && a.asistio).map(a => contactMap[a.contactId]).filter(Boolean);
                    const memberLine = memberIds.length ? ' <span class="member-note">(' + memberIds.join(', ') + ')</span>' : '';
                    lists += li(App.esc(gName) + memberLine);
                }
                lists += '</ul>';
            }
            if (ausentes.length) {
                lists += '<h3>' + App._t('pdf.absentGroups') + '</h3><ul>';
                for (const ae of ausentes) {
                    const gName = groupMap[ae.groupId];
                    if (!gName) continue;
                    let txt = App.esc(gName);
                    if (ae.motivo) txt += ' <span class="reason">&mdash; ' + App._t('pdf.reason') + ': ' + App.esc(ae.motivo) + '</span>';
                    lists += li(txt, 'absent-item');
                }
                lists += '</ul>';
            }
            groupHtml = lists;
        } else {
            groupHtml = '<p>' + App._t('pdf.noGroupAtt') + '</p>';
        }

        // Individual contacts in group-type meetings (those without a group)
        const indEntries = attRows.filter(a => a.contactId && !a.groupId);
        if (indEntries.length) {
            const asistentes = indEntries.filter(a => a.asistio).map(a => contactMap[a.contactId]).filter(Boolean);
            const avisos = indEntries.filter(a => !a.asistio && a.avisoAusencia).map(a => ({
                nombre: contactMap[a.contactId] || 'ID:' + a.contactId,
                motivo: a.motivo || ''
            })).filter(a => a.nombre);
            const ausentes = indEntries.filter(a => !a.asistio && !a.avisoAusencia).map(a => contactMap[a.contactId]).filter(Boolean);

            if (asistentes.length || avisos.length || ausentes.length) {
                indHtml += '<h3>' + App._t('pdf.indContacts') + '</h3>';
                if (asistentes.length) {
                    indHtml += '<ul><li>' + asistentes.join('</li><li>') + '</li></ul>';
                }
                if (avisos.length) {
                    indHtml += '<h3>' + App._t('pdf.warnedAbsences') + '</h3><ul>';
                    indHtml += avisos.map(a => {
                        let txt = App.esc(a.nombre);
                        if (a.motivo) txt += ' <span class="reason">&mdash; ' + App._t('pdf.reason') + ': ' + App.esc(a.motivo) + '</span>';
                        return li(txt, 'warned-item');
                    }).join('');
                    indHtml += '</ul>';
                }
                if (ausentes.length) {
                    indHtml += '<h3>' + App._t('pdf.absentees') + '</h3><ul>';
                    indHtml += ausentes.map(n => li(App.esc(n), 'absent-item')).join('');
                    indHtml += '</ul>';
                }
            } else {
                indHtml = '<p>' + App._t('pdf.noIndAtt') + '</p>';
            }
        } else {
            indHtml = '<p>' + App._t('pdf.noIndAtt') + '</p>';
        }
    } else {
        // ===== ESPECIAL: all contacts individual =====
        const indEntries = attRows.filter(a => a.contactId);
        if (indEntries.length) {
            const asistentes = indEntries.filter(a => a.asistio).map(a => contactMap[a.contactId]).filter(Boolean);
            const avisos = indEntries.filter(a => !a.asistio && a.avisoAusencia).map(a => ({
                nombre: contactMap[a.contactId] || 'ID:' + a.contactId,
                motivo: a.motivo || ''
            })).filter(a => a.nombre);
            const ausentes = indEntries.filter(a => !a.asistio && !a.avisoAusencia).map(a => contactMap[a.contactId]).filter(Boolean);

            let lists = '';
            if (asistentes.length) {
                lists += '<h3>' + App._t('pdf.attendees') + '</h3><ul>';
                lists += asistentes.map(n => li(App.esc(n))).join('');
                lists += '</ul>';
            }
            if (avisos.length) {
                lists += '<h3>' + App._t('pdf.warnedAbsences') + '</h3><ul>';
                lists += avisos.map(a => {
                    let txt = App.esc(a.nombre);
                    if (a.motivo) txt += ' <span class="reason">&mdash; ' + App._t('pdf.reason') + ': ' + App.esc(a.motivo) + '</span>';
                    return li(txt, 'warned-item');
                }).join('');
                lists += '</ul>';
            }
            if (ausentes.length) {
                lists += '<h3>' + App._t('pdf.absentees') + '</h3><ul>';
                lists += ausentes.map(n => li(App.esc(n), 'absent-item')).join('');
                lists += '</ul>';
            }
            indHtml = lists;
        } else {
            indHtml = '<p>' + App._t('pdf.noIndAtt') + '</p>';
        }
    }

    const dateStr = meeting.fecha ? new Date(meeting.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Sin fecha';
    const tipoLabel = meeting.tipo || 'Ordinaria';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${App._t('pdf.title', meeting.titulo)}</title>
        <style>
            @page { margin: 25mm 20mm; }
            body { font-family: Georgia, 'Times New Roman', Times, serif; font-size: 11pt; color: #222; line-height: 1.7; }
            h1 { font-size: 16pt; text-align: center; margin-bottom: 2px; color: #000; font-weight: 700; }
            .subtitle { text-align: center; font-size: 10pt; color: #666; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
            .date { text-align: center; font-size: 10pt; color: #888; margin-bottom: 28px; }
            hr.divider { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
            h2 { font-size: 13pt; color: #000; margin-top: 22px; margin-bottom: 10px; font-weight: 700; }
            h2:after { content: ''; display: block; width: 40px; border-bottom: 2px solid #999; margin-top: 4px; }
            h3 { font-size: 11pt; color: #333; margin: 12px 0 4px 0; font-weight: 600; }
            p { margin: 6px 0; text-align: justify; }
            ul { margin: 2px 0 8px 0; padding-left: 22px; }
            li { margin-bottom: 2px; }
            .absent-item { color: #991b1b; }
            .warned-item { color: #b45309; }
            .reason { color: #555; font-size: 10pt; }
            .member-note { color: #555; font-size: 10pt; }
            .resolved { color: #166534; font-weight: 600; }
            .pending { color: #991b1b; }
            .topic { margin-bottom: 18px; page-break-inside: avoid; }
            .topic h3 { font-size: 12pt; font-weight: 700; margin-bottom: 4px; color: #000; }
            .topic h3 .num { color: #555; margin-right: 6px; }
            .topic h3 .status { font-size: 9pt; font-weight: 600; margin-left: 8px; }
            .topic .desc { margin: 4px 0 4px 18px; color: #333; }
            .topic .sol { margin: 4px 0 4px 18px; padding: 6px 10px; background: #f0fdf4; border-left: 3px solid #166534; color: #166534; border-radius: 2px; font-size: 10pt; }
            .topic .sol strong { font-weight: 700; }
            .topic .comentario { font-size: 10pt; color: #555; background: #f9fafb; padding: 4px 8px; border-radius: 2px; margin-left: 18px; }
            .topic .history { margin: 6px 0 4px 18px; font-size: 10pt; color: #444; }
            .topic .history > strong { font-size: 10pt; color: #333; display: block; margin-bottom: 2px; }
            .topic .history-entry { margin: 2px 0 2px 12px; padding: 3px 0; border-bottom: 1px dotted #ddd; }
            .topic .history-entry:last-child { border-bottom: none; }
            .topic .hist-comentario { color: #555; font-style: italic; }
            .firma { margin-top: 48px; display: flex; justify-content: space-between; }
            .firma div { text-align: center; width: 180px; }
            .firma hr { margin-bottom: 4px; border: none; border-top: 1px solid #999; }
            .firma span { font-size: 9pt; color: #666; }
        </style>
    </head>
    <body>
        <h1>${App.esc(meeting.titulo)}</h1>
        <div class="subtitle">${App._t('pdf.docType')}</div>
        <div class="date">${dateStr}${meeting.lugar ? ' &middot; ' + App.esc(meeting.lugar) : ''}</div>

        <hr class="divider">

        <h2>${App._t('pdf.attendance')}</h2>
        ${isGroupType ? groupHtml : ''}
        ${indHtml}

        <hr class="divider">

        <h2>${App._t('pdf.topicsTitle')}</h2>
        ${topics.length ? topics.map((t, i) => {
            let historial = [];
            try { historial = JSON.parse(t.historial || '[]'); } catch (e) {}
            const historialHtml = historial.length ? `
                <div class="history">
                    <strong>${App._t('topics.historialTitle')}</strong>
                    ${historial.map(h => `<div class="history-entry">
                        <em>${App.esc(h.meetingTitulo)}${h.fecha ? ' (' + h.fecha + ')' : ''}</em>
                        ${h.comentario ? '<br><span class="hist-comentario">' + App.esc(h.comentario) + '</span>' : ''}
                    </div>`).join('')}
                </div>` : '';
            return `
        <div class="topic">
            <h3><span class="num">${i + 1}.</span>${App.esc(t.titulo)}<span class="status ${t.resuelto ? 'resolved' : 'pending'}">${t.resuelto ? App._t('pdf.resolved') : App._t('pdf.pending')}</span></h3>
            ${t.resumen ? '<div class="desc">' + App.esc(t.resumen) + '</div>' : ''}
            ${t.comentario ? '<div class="comentario"><em>' + App.esc(t.comentario) + '</em></div>' : ''}
            ${t.resuelto && t.solucion ? '<div class="sol"><strong>' + App._t('pdf.solution') + '</strong> ' + App.esc(t.solucion) + '</div>' : ''}
            ${historialHtml}
        </div>`;
        }).join('') : '<p>' + App._t('pdf.noTopics') + '</p>'}

        <hr class="divider">

        <div class="firma">
            <div>
                <hr>
                <span>${App._t('pdf.firm1')}</span>
            </div>
            <div>
                <hr>
                <span>${App._t('pdf.firm2')}</span>
            </div>
            <div>
                <hr>
                <span>${App._t('pdf.firm3')}</span>
            </div>
        </div>
    </body>
    </html>`;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return App.alert('Bloqueador', 'Permite ventanas emergentes para ver el PDF.', 'warning');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () {
        win.print();
    }, 500);
};
App.saveMeetingPdf = App.generatePDF;
