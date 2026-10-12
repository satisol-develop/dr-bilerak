const App = {
    currentPage: 'home',
    editingId: null,
    currentMeetingId: null,
    currentUser: null,

    applyStaticLang() {
        document.querySelectorAll('[i18n]').forEach(el => {
            const key = el.getAttribute('i18n');
            if (key) el.textContent = App._t(key);
        });
    },

    async initApp() {
        this.applyStaticLang();
        document.querySelectorAll('#bottom-nav .nav-item').forEach(item => {
            item.onclick = () => {
                const page = item.dataset.page;
                this.navTo(page);
                document.querySelectorAll('#bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            };
        });
        document.getElementById('modal-overlay').onclick = () => this.closeModal();
        document.getElementById('login-username').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('login-password').focus();
        });
        document.getElementById('login-password').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.login();
        });
        await this.migrateContactGroups();
        await this.renderHome();
        this.navTo('home');
    },

    async migrateContactGroups() {
        // One-time migration: existing contacts with groupId -> contact_groups
        const existing = await DB.contact_groups.count();
        if (existing > 0) return;
        const contacts = await DB.contacts.where('groupId').notEqual('').and(c => c.groupId != null).toArray();
        for (const c of contacts) {
            if (c.groupId) {
                await DB.contact_groups.add({ contactId: c.id, groupId: c.groupId });
            }
        }
    },

    navTo(page, param) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const el = document.getElementById('page-' + page);
        if (!el) {
            this.navTo('home');
            return;
        }
        // Trigger reflow for animation
        void el.offsetWidth;
        el.classList.add('active');
        document.querySelectorAll('#bottom-nav .nav-item').forEach(i => {
            i.classList.toggle('active', i.dataset.page === page);
        });
        this.currentPage = page;
        document.getElementById('header-actions').innerHTML = '';
        document.getElementById('app-title').textContent = this.getTitle(page);

        switch (page) {
            case 'home': this.renderHome(); break;
            case 'groups': this.renderGroups(); break;
            case 'contacts': this.renderContacts(); break;
            case 'meetings': this.renderMeetings(); break;
            case 'meeting-detail': this.renderMeetingDetail(param); break;
            case 'topics': this.renderTopics(); break;
            case 'settings': this.renderSettings(); break;
        }
    },

    getTitle(page) {
        const titles = {
            home: App._t('home.title'),
            groups: App._t('groups.title'),
            contacts: App._t('contacts.title'),
            meetings: App._t('meetings.title'),
            'meeting-detail': App._t('meetings.detail'),
            topics: App._t('topics.title'),
            settings: App._t('settings.title')
        };
        return titles[page] || App._t('appName');
    },

    async renderHome() {
        const meetings = await DB.meetings.orderBy('fecha').reverse().limit(5).toArray();
        const pending = await DB.topics.where('resuelto').equals(0).toArray();
        const meetingsCount = await DB.meetings.count();
        const groupsCount = await DB.groups.count();
        const pendingCount = pending.length;

        let meetingsHtml = '';
        if (!meetings.length) {
            meetingsHtml = '<p style="color:var(--text-secondary);font-size:14px;margin:8px 0;">' + App._t('home.noMeetings') + '</p>';
        } else {
            meetingsHtml = meetings.map(m => {
                const fecha = new Date(m.fecha).toLocaleDateString(App._lang === 'eu' ? 'eu-ES' : 'es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
                return `<div class="feed-item" onclick="App.navTo('meeting-detail',${m.id})">
                    <div class="feed-icon">&#x1F4C4;</div>
                    <div class="feed-content">
                        <div class="feed-title">${this.esc(m.titulo)}</div>
                        <div class="feed-meta">${fecha}</div>
                    </div>
                    <span class="feed-arrow">&rarr;</span>
                </div>`;
            }).join('');
        }

        let pendingHtml = '';
        if (!pending.length) {
            pendingHtml = '<p style="color:var(--text-secondary);font-size:14px;margin:8px 0;">' + App._t('home.noPending') + '</p>';
        } else {
            pendingHtml = pending.slice(0, 5).map(t => {
                const meetingTitle = 'Acta #' + t.meetingId;
                return `<div class="feed-item" onclick="App.navTo('meeting-detail',${t.meetingId})">
                    <div class="feed-icon" style="color:var(--warning);">&#x26A0;</div>
                    <div class="feed-content">
                        <div class="feed-title">${this.esc(t.titulo)}</div>
                        <div class="feed-meta">${meetingTitle}${t.resumen ? ' &middot; ' + this.esc(t.resumen.substring(0, 60)) : ''}</div>
                    </div>
                    <span class="feed-arrow">&rarr;</span>
                </div>`;
            }).join('');
        }

        const h = document.getElementById('page-home');
        h.innerHTML = `
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <div class="mini-stat" onclick="App.navTo('groups')">
                    <strong>${groupsCount}</strong> ${App._t('home.groups')}
                </div>
                <div class="mini-stat" onclick="App.navTo('meetings')">
                    <strong>${meetingsCount}</strong> ${App._t('home.meetings')}
                </div>
                <div class="mini-stat" onclick="App.navTo('topics')">
                    <strong>${pendingCount}</strong> ${App._t('home.pending')}
                </div>
            </div>
            <div class="section-title">&#x1F4C5; ${App._t('home.lastMeetings')}</div>
            ${meetingsHtml}
            <div class="section-title" style="margin-top:16px;">&#x26A0; ${App._t('home.pendingTopics')}</div>
            ${pendingHtml}
        `;
    },

    renderSettings() {
        const h = document.getElementById('page-settings');
        const currentLang = App._lang;
        h.innerHTML = `
            <div style="text-align:center;padding:24px 0;">
                <div style="font-size:48px;margin-bottom:8px;">&#x1F464;</div>
                <div style="font-weight:600;font-size:16px;">${this.esc(this.currentUser ? this.currentUser.nombre : '')}</div>
                <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">
                    ${this.currentUser ? this.currentUser.username : ''}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:24px;">
                    ${App._t('appName')} v${App._t('appVersion')}
                </div>
                
                <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;margin:0 auto;">
                    <div class="form-group">
                        <label>${App._t('settings.language')}</label>
                        <select id="lang-select" onchange="App.setLang(this.value)">
                            <option value="es" ${currentLang === 'es' ? 'selected' : ''}>${App._t('settings.langEs')}</option>
                            <option value="eu" ${currentLang === 'eu' ? 'selected' : ''}>${App._t('settings.langEu')}</option>
                        </select>
                    </div>
                    <button class="btn primary" onclick="App.generateDummyData()" style="width:100%;justify-content:center;">
                        &#x1F4CB; ${App._t('settings.generateData')}
                    </button>
                    <button class="btn danger" onclick="App.resetDatabase()" style="width:100%;justify-content:center;">
                        &#x1F5D1; ${App._t('settings.resetDB')}
                    </button>
                    <hr style="border:none;border-top:1px solid var(--border);margin:8px 0;">
                    <button class="btn secondary" onclick="App.logout()" style="width:100%;justify-content:center;">
                        &#x1F6AA; ${App._t('settings.logout')}
                    </button>
                </div>
            </div>
        `;
    },

    async generateDummyData() {
        const ok = await App.confirm(
            App._t('settings.generateData'),
            App._t('settings.generateConfirm')
        );
        if (!ok) return;

        // ======= 10 Groups (music bands) =======
        const groupNames = [
            'Los Ac\u00fasticos', 'Banda Nocturna', 'Ritmo Interior',
            'Armon\u00eda Viva', 'Cuerdas al Aire', 'La Frecuencia',
            'Sonido Abierto', 'Vibraciones', 'Notas Libres',
            'El Comp\u00e1s'
        ];
        const gIds = [];
        for (const name of groupNames) {
            gIds.push(await DB.groups.add({ nombre: name }));
        }

        // ======= 35 Contacts (3 per group + 5 individual) =======
        const firstNames = ['Juan', 'Mar\u00eda', 'Carlos', 'Ana', 'Laura', 'Pedro', 'Sof\u00eda', 'Luis', 'Elena', 'David',
            'Raquel', 'Miguel', 'Paula', 'Jorge', 'Clara', 'Andr\u00e9s', 'Irene', 'Fernando', 'Rosa', 'Hugo',
            'Marta', 'Alberto', 'Silvia', 'Pablo', 'Cristina', 'Diego', 'Andrea', 'Manuel', 'Carmen', 'Javier',
            'Natalia', 'V\u00edctor', 'Ruth', 'Sergio', 'Noelia'];
        const lastNames = ['P\u00e9rez', 'Garc\u00eda', 'L\u00f3pez', 'Mart\u00edn', 'D\u00edaz', 'S\u00e1nchez', 'Ram\u00edrez', 'Torres', 'Flores', 'Rivera',
            'Cruz', 'Morales', 'Ortiz', 'Reyes', 'G\u00f3mez', 'Vargas', 'Castro', 'Ramos', 'Jim\u00e9nez', 'Molina',
            'Navarro', 'Ortega', 'Delgado', 'Romero', 'Medina'];

        const allContacts = [];
        for (let i = 0; i < 35; i++) {
            const name = firstNames[i % firstNames.length] + ' ' + lastNames[i % lastNames.length];
            const cId = await DB.contacts.add({
                nombre: name,
                telefono: '6' + String(10000000 + Math.floor(Math.random() * 90000000)),
                email: name.toLowerCase().replace(/\s/g, '.') + '@email.com',
                tipo: i < 30 ? 'group' : 'individual'
            });
            allContacts.push(cId);
        }

        // ======= Group memberships (first 3 contacts per group, last 5 are individual) =======
        const cgBatch = [];
        for (let gi = 0; gi < 10; gi++) {
            for (let m = 0; m < 3; m++) {
                const cIdx = gi * 3 + m;
                cgBatch.push({ contactId: allContacts[cIdx], groupId: gIds[gi] });
            }
        }
        // Some contacts in multiple groups (first 3 contacts join a second group)
        cgBatch.push({ contactId: allContacts[0], groupId: gIds[1] });
        cgBatch.push({ contactId: allContacts[3], groupId: gIds[2] });
        cgBatch.push({ contactId: allContacts[6], groupId: gIds[4] });
        await DB.contact_groups.bulkAdd(cgBatch);

        // ======= 12 Meetings with types =======
        const meetingTypes = ['Ordinaria', 'Extraordinaria', 'Ordinaria', 'Especial', 'Ordinaria',
            'Extraordinaria', 'Comisi\u00f3n', 'Ordinaria', 'Extraordinaria', 'Especial',
            'Ordinaria', 'Comisi\u00f3n'];
        const meetingData = [
            { titulo: 'Reuni\u00f3n mensual enero', fecha: '2026-01-20', notas: 'Se trataron temas presupuestarios.' },
            { titulo: 'Asamblea general febrero', fecha: '2026-02-15', notas: 'Elecci\u00f3n de nuevos miembros.' },
            { titulo: 'Reuni\u00f3n ordinaria marzo', fecha: '2026-03-10', notas: '' },
            { titulo: 'Sesi\u00f3n especial abril', fecha: '2026-04-05', notas: 'Asistencia individual abierta.' },
            { titulo: 'Taller de formaci\u00f3n mayo', fecha: '2026-05-12', notas: 'Capacitaci\u00f3n en liderazgo.' },
            { titulo: 'Reuni\u00f3n extraordinaria junio', fecha: '2026-06-08', notas: 'Tema urgente de presupuesto.' },
            { titulo: 'Festividad anual julio', fecha: '2026-07-19', notas: 'Organizaci\u00f3n del evento anual.' },
            { titulo: 'Comit\u00e9 de evaluaci\u00f3n agosto', fecha: '2026-08-03', notas: 'Evaluaci\u00f3n de resultados.' },
            { titulo: 'Plan estrat\u00e9gico septiembre', fecha: '2026-09-14', notas: 'Definici\u00f3n de objetivos 2027.' },
            { titulo: 'Reuni\u00f3n abierta octubre', fecha: '2026-10-05', notas: 'Abierta a todos los contactos.' },
            { titulo: 'Cierre del ejercicio noviembre', fecha: '2026-11-16', notas: 'Balance anual.' },
            { titulo: 'Asamblea general diciembre', fecha: '2026-12-14', notas: 'Elecci\u00f3n y cierre del a\u00f1o.' }
        ];
        const mIds = [];
        for (let mi = 0; mi < meetingData.length; mi++) {
            mIds.push(await DB.meetings.add({ ...meetingData[mi], tipo: meetingTypes[mi] }));
        }

        // ======= Attendance =======
        const attBatch = [];
        for (let mi = 0; mi < mIds.length; mi++) {
            const tipo = meetingTypes[mi];
            const isGroupType = tipo !== 'Especial';

            if (isGroupType) {
                for (let gi = 0; gi < 10; gi++) {
                    // Group-level record (determines present/absent toggle + motivo)
                    const groupPresent = Math.random() > 0.2;
                    attBatch.push({
                        meetingId: mIds[mi], contactId: null, groupId: gIds[gi],
                        asistio: groupPresent, avisoAusencia: !groupPresent && Math.random() > 0.4,
                        motivo: !groupPresent ? (Math.random() > 0.5 ? 'Compromiso previo' : 'Por motivos personales') : ''
                    });
                    // Member-level records (show as tags when group is present)
                    if (groupPresent) {
                        for (let m = 0; m < 3; m++) {
                            const cIdx = gi * 3 + m;
                            if (Math.random() > 0.15) {
                                attBatch.push({
                                    meetingId: mIds[mi], contactId: allContacts[cIdx], groupId: gIds[gi],
                                    asistio: true, avisoAusencia: false, motivo: ''
                                });
                            }
                        }
                    }
                }
                // Individual contacts (without group) in group-type meetings
                for (let ci = 30; ci < 35; ci++) {
                    const asist = Math.random() > 0.3;
                    attBatch.push({
                        meetingId: mIds[mi], contactId: allContacts[ci], groupId: null,
                        asistio: asist,
                        avisoAusencia: !asist && Math.random() > 0.5,
                        motivo: !asist ? (Math.random() > 0.5 ? 'No pudo asistir' : 'Ausente sin aviso') : ''
                    });
                }
            } else {
                // Especial: all contacts regardless of group
                for (let ci = 0; ci < 35; ci++) {
                    const asist = Math.random() > 0.25;
                    attBatch.push({
                        meetingId: mIds[mi], contactId: allContacts[ci], groupId: null,
                        asistio: asist,
                        avisoAusencia: !asist && Math.random() > 0.5,
                        motivo: !asist ? (Math.random() > 0.5 ? 'No pudo asistir' : 'Ausente sin aviso') : ''
                    });
                }
            }
        }
        await DB.attendance.bulkAdd(attBatch);

        // ======= Topics (3-4 per meeting) =======
        const topicTemplates = [
            'Presupuesto anual', 'Renovaci\u00f3n de carnet', 'Plan de actividades',
            'Informe de tesorer\u00eda', 'Elecci\u00f3n de cargos', 'Cuota anual',
            'Organizaci\u00f3n de eventos', 'Propuesta de mejora', 'Estado de cuentas',
            'Calendario de reuniones', 'Informe de gesti\u00f3n', 'Nuevas inscripciones',
            'Mantenimiento de instalaciones', 'Captaci\u00f3n de voluntarios', 'Comunicaci\u00f3n y redes',
            'Evaluaci\u00f3n de proyectos', 'Formaci\u00f3n continua', 'Colaboraciones externas'
        ];
        const resumenes = [
            'Se analizaron los datos disponibles y se abri\u00f3 debate.',
            'Se expusieron los puntos clave y se recogieron opiniones.',
            'Revisi\u00f3n del estado actual y propuestas de mejora.',
            'Puesta en com\u00fan de los avances realizados hasta la fecha.',
            'Debate abierto sobre las implicaciones y posibles v\u00edas de actuaci\u00f3n.'
        ];
        // Pass 1: generate all topics without historial
        const allTopics = [];
        for (let mi = 0; mi < mIds.length; mi++) {
            const numTopics = 3 + Math.floor(Math.random() * 2);
            const usedTemplates = new Set();
            for (let t = 0; t < numTopics; t++) {
                let idx;
                do { idx = Math.floor(Math.random() * topicTemplates.length); } while (usedTemplates.has(idx));
                usedTemplates.add(idx);
                const resuelto = Math.random() > 0.45 ? 1 : 0;
                const comentario = Math.random() > 0.4 ? resumenes[Math.floor(Math.random() * resumenes.length)] : '';
                allTopics.push({
                    meetingId: mIds[mi],
                    titulo: topicTemplates[idx],
                    resumen: 'Tema tratado en la reuni\u00f3n.',
                    resuelto: resuelto,
                    solucion: resuelto ? 'Aprobado por mayor\u00eda.' : '',
                    comentario: comentario,
                    esPendiente: 0,
                    historial: '[]'
                });
            }
        }
        // Pass 2: add historial to topics in later meetings that reference actual same-titled topics
        for (let i = 0; i < allTopics.length; i++) {
            const t = allTopics[i];
            const mi = mIds.indexOf(t.meetingId);
            if (mi >= 3 && Math.random() > 0.6) {
                // Find an earlier topic with the same title
                const earlier = allTopics.filter((ot, oi) => oi < i && ot.titulo === t.titulo);
                if (earlier.length) {
                    const src = earlier[Math.floor(Math.random() * earlier.length)];
                    const srcMi = mIds.indexOf(src.meetingId);
                    const hEntry = {
                        meetingId: src.meetingId,
                        meetingTitulo: meetingData[srcMi].titulo,
                        fecha: meetingData[srcMi].fecha,
                        comentario: src.comentario || resumenes[Math.floor(Math.random() * resumenes.length)]
                    };
                    t.historial = JSON.stringify([hEntry]);
                }
            }
        }
        await DB.topics.bulkAdd(allTopics);

        App.toast(App._t('settings.generateSuccess'), 'success');
        this.renderHome();
    },

    async resetDatabase() {
        const ok = await App.confirm(
            App._t('settings.resetConfirm'),
            App._t('settings.resetText')
        );
        if (!ok) return;
        const ok2 = await App.confirm(
            App._t('settings.resetConfirm2'),
            App._t('settings.resetText2')
        );
        if (!ok2) return;

        await DB.groups.clear();
        await DB.contacts.clear();
        await DB.contact_groups.clear();
        await DB.meetings.clear();
        await DB.attendance.clear();
        await DB.topics.clear();

        App.toast(App._t('settings.resetSuccess'), 'success');
        this.renderHome();
        if (this.currentPage === 'settings') this.renderSettings();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (!App.checkAuth()) {
        // Show login (already visible by default)
    }
});
