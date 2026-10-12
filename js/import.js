// ======================== IMPORT / EXPORT ========================

App.showImportForm = function () {
    App.showModal(
        App._t('import.title'),
        `<div class="form-group">
            <label>${App._t('import.fileLabel')}</label>
            <input type="file" id="import-file" accept=".csv,.xlsx,.xls" />
        </div>
        <div id="import-preview" style="border:1px dashed var(--border);border-radius:8px;padding:12px;background:var(--bg);font-size:13px;color:var(--text-secondary);">
            ${App._t('import.preview')}
        </div>`,
        `<button class="btn secondary" onclick="App.downloadTemplate()">${App._t('import.downloadTemplate')}</button>
          <button class="btn primary" onclick="App.importFile()">${App._t('import.importBtn')}</button>`
    );
    App.renderImport();
};

App.renderImport = async function () {
    const fileSelect = document.getElementById('import-file');
    const previewDiv = document.getElementById('import-preview');
    fileSelect.onchange = function () {
        const file = fileSelect.files[0];
        if (!file) { previewDiv.innerHTML = ''; return; }
        const reader = new FileReader();
        reader.onload = function (e) {
            let text;
            if (file.name.endsWith('.csv')) {
                text = e.target.result;
                previewDiv.innerHTML = '<pre style="max-height:200px;overflow:auto;font-size:12px;background:var(--surface);padding:8px;border-radius:8px;white-space:pre-wrap;">' + App.esc(text.substring(0, 2000)) + '</pre>';
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                previewDiv.innerHTML = '<p style="color:var(--text-secondary);">Archivo Excel cargado. Haz clic en Importar para procesarlo.</p>';
            } else {
                previewDiv.innerHTML = '<p style="color:var(--danger);">' + App._t('import.formatError') + '</p>';
            }
        };
        if (file.name.endsWith('.csv')) reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
    };
};

App.importFile = async function () {
    const file = document.getElementById('import-file').files[0];
    if (!file) return App.alert(App._t('import.fileRequired'), App._t('import.fileRequiredText'), 'warning');
    try {
        const datos = await App.parseImportFile(file);
        if (datos.length < 2) return App.alert('Error', App._t('import.error'), 'error');
        const headers = datos[0];
        const rows = datos.slice(1);
        const meetingsMap = {};
        const groupsMap = {};
        let imported = 0;
        for (const row of rows) {
            const actaIdx = headers.findIndex(h => /^acta$/i.test(h));
            const fechaIdx = headers.findIndex(h => /^fecha$/i.test(h));
            const grupoIdx = headers.findIndex(h => /^grupo|agrupacion/i.test(h));
            const contactoIdx = headers.findIndex(h => /^contacto|nombre/i.test(h));
            const presenteIdx = headers.findIndex(h => /^presente|asistio/i.test(h));
            if (actaIdx === -1 || contactoIdx === -1) continue;
            const actaTitulo = (row[actaIdx] || '').trim();
            const contactoTxt = (row[contactoIdx] || '').trim();
            if (!actaTitulo || !contactoTxt) continue;
            if (!meetingsMap[actaTitulo]) {
                const fecha = fechaIdx >= 0 ? row[fechaIdx] : new Date().toISOString().split('T')[0];
                const id = await DB.meetings.add({ titulo: actaTitulo, fecha, lugar: '', activa: 1 });
                meetingsMap[actaTitulo] = id;
            }
            let contactId;
            const existing = await DB.contacts.where('nombre').equals(contactoTxt).first();
            if (existing) {
                contactId = existing.id;
            } else {
                let groupId = null;
                if (grupoIdx >= 0 && row[grupoIdx]) {
                    const gTxt = row[grupoIdx].trim();
                    if (!groupsMap[gTxt]) {
                        const existingG = await DB.groups.where('nombre').equals(gTxt).first();
                        if (existingG) {
                            groupsMap[gTxt] = existingG.id;
                        } else {
                            groupsMap[gTxt] = await DB.groups.add({ nombre: gTxt });
                        }
                    }
                    groupId = groupsMap[gTxt];
                }
                contactId = await DB.contacts.add({ nombre: contactoTxt });
                if (groupId) await DB.contact_groups.add({ contactId, groupId });
            }
            const presente = presenteIdx === -1 || row[presenteIdx] !== '0';
            const meetingId = meetingsMap[actaTitulo];
            const existingAtt = await DB.attendance.where({ meetingId, contactId }).first();
            if (!existingAtt) {
                await DB.attendance.add({ meetingId, contactId, asistio: presente ? 1 : 0, avisoAusencia: false, motivo: presente ? '' : 'Sin especificar', groupId: null });
            }
            imported++;
        }
        App.showSnackbar(App._t('import.completed', imported), 'success');
        App.renderHome();
        App.navTo('contacts');
    } catch (e) {
        App.alert(App._t('errors.importError'), e.message || App._t('import.unknownError'), 'error');
    }
};

App.parseImportFile = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                if (file.name.endsWith('.csv')) {
                    const text = e.target.result;
                    const lines = text.split(/\r?\n/).filter(l => l.trim());
                    const data = lines.map(l => {
                        const parts = [];
                        let current = '';
                        let inQuotes = false;
                        for (const ch of l) {
                            if (ch === '"') inQuotes = !inQuotes;
                            else if (ch === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
                            else current += ch;
                        }
                        parts.push(current.trim());
                        return parts;
                    });
                    resolve(data);
                } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    if (typeof XLSX === 'undefined') return reject(new Error(App._t('import.noLibrary')));
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    resolve(json);
                } else reject(new Error(App._t('import.formatError')));
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        if (file.name.endsWith('.csv')) reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
    });
};

App.downloadTemplate = function () {
    const template = 'Acta,Fecha,Grupo,Contacto,Presente\n"Reuni\u00f3n Ejemplo","2025-01-15","Grupo A","Juan P\u00e9rez",1\n"Reuni\u00f3n Ejemplo","2025-01-15","Grupo A","Mar\u00eda Garc\u00eda",0\n"Reuni\u00f3n Ejemplo","2025-01-15","Grupo B","Carlos L\u00f3pez",1\n';
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_asistencia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
