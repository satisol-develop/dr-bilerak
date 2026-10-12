// ======================== TOPICS ========================

App.addTopic = function (meetingId) {
    App.showModal(
        App._t('topics.new'),
        `<div class="form-group">
            <label>${App._t('topics.titleLabel')}</label>
            <input id="f-topic-title" placeholder="${App._t('topics.titlePlaceholder')}" />
        </div>
        <div class="form-group">
            <label>${App._t('topics.summaryLabel')}</label>
            <textarea id="f-topic-summary" placeholder="${App._t('topics.summaryPlaceholder')}"></textarea>
        </div>
        <div class="form-group">
            <label>${App._t('topics.comentarioLabel')}</label>
            <textarea id="f-topic-comentario" placeholder="${App._t('topics.comentarioPlaceholder')}"></textarea>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="f-topic-resolved" onchange="document.getElementById('f-topic-solucion-wrap').style.display=this.checked?'':'none'" />
            <label for="f-topic-resolved" style="margin-bottom:0;">${App._t('topics.resolvedLabel')}</label>
        </div>
        <div class="form-group" id="f-topic-solucion-wrap" style="display:none;">
            <label>${App._t('topics.solucionLabel')}</label>
            <textarea id="f-topic-solucion" placeholder="${App._t('topics.solucionPlaceholder')}"></textarea>
        </div>`,
        `<button class="btn secondary" onclick="App.closeModal()">${App._t('common.cancel')}</button>
         <button class="btn primary" onclick="App.saveNewTopic(${meetingId})">${App._t('common.save')}</button>`
    );
};

App.saveNewTopic = async function (meetingId) {
    const titulo = document.getElementById('f-topic-title').value.trim();
    if (!titulo) return App.alert(App._t('errors.required'), App._t('topics.titleRequired'), 'warning');
    const resuelto = document.getElementById('f-topic-resolved').checked;
    await DB.topics.add({
        meetingId,
        titulo,
        resumen: document.getElementById('f-topic-summary').value.trim(),
        resuelto: resuelto ? 1 : 0,
        solucion: resuelto ? document.getElementById('f-topic-solucion').value.trim() : '',
        comentario: document.getElementById('f-topic-comentario').value.trim(),
        esPendiente: false,
        historial: '[]'
    });
    App.closeModal();
    App.renderMeetingDetail(meetingId);
};

App.editTopic = async function (topicId) {
    const topic = await DB.topics.get(topicId);
    if (!topic) return;
    App.editingId = topicId;
    const solucionDisplay = topic.resuelto ? '' : 'display:none;';
    App.showModal(
        App._t('topics.edit'),
        `<div class="form-group">
            <label>${App._t('topics.titleLabel')}</label>
            <input id="f-topic-title" value="${App.esc(topic.titulo)}" />
        </div>
        <div class="form-group">
            <label>${App._t('topics.summaryLabel')}</label>
            <textarea id="f-topic-summary">${App.esc(topic.resumen || '')}</textarea>
        </div>
        <div class="form-group">
            <label>${App._t('topics.comentarioLabel')}</label>
            <textarea id="f-topic-comentario">${App.esc(topic.comentario || '')}</textarea>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="f-topic-resolved" ${topic.resuelto ? 'checked' : ''} onchange="document.getElementById('f-topic-solucion-wrap').style.display=this.checked?'':'none'" />
            <label for="f-topic-resolved" style="margin-bottom:0;">${App._t('topics.resolvedLabel')}</label>
        </div>
        <div class="form-group" id="f-topic-solucion-wrap" style="${solucionDisplay}">
            <label>${App._t('topics.solucionLabel')}</label>
            <textarea id="f-topic-solucion">${App.esc(topic.solucion || '')}</textarea>
        </div>`,
        `<button class="btn secondary" onclick="App.closeModal()">${App._t('common.cancel')}</button>
         <button class="btn primary" onclick="App.saveTopic(${topic.meetingId})">${App._t('common.save')}</button>`
    );
};

App.saveTopic = async function (meetingId) {
    const titulo = document.getElementById('f-topic-title').value.trim();
    if (!titulo) return App.alert(App._t('errors.required'), App._t('topics.titleRequired'), 'warning');
    const resuelto = document.getElementById('f-topic-resolved').checked;
    await DB.topics.update(App.editingId, {
        titulo,
        resumen: document.getElementById('f-topic-summary').value.trim(),
        resuelto: resuelto ? 1 : 0,
        solucion: resuelto ? document.getElementById('f-topic-solucion').value.trim() : '',
        comentario: document.getElementById('f-topic-comentario').value.trim()
    });
    App.editingId = null;
    App.closeModal();
    App.renderMeetingDetail(meetingId);
};

App.toggleResolved = async function (topicId) {
    const topic = await DB.topics.get(topicId);
    if (!topic) return;
    const newVal = topic.resuelto ? 0 : 1;
    if (newVal === 1) {
        const { value } = await Swal.fire({
            title: App._t('topics.markResolvedTitle'),
            input: 'textarea',
            inputLabel: App._t('topics.markResolvedLabel'),
            inputPlaceholder: App._t('topics.markResolvedPlaceholder'),
            showCancelButton: true,
            confirmButtonText: App._t('topics.resolveBtn'),
            cancelButtonText: App._t('topics.cancelBtn'),
            confirmButtonColor: '#475569',
            inputValue: topic.solucion || ''
        });
        if (value === undefined) return;
        await DB.topics.update(topicId, { resuelto: 1, solucion: value.trim() });
    } else {
        await DB.topics.update(topicId, { resuelto: 0, solucion: '' });
    }
    if (App.currentMeetingId) App.renderMeetingDetail(App.currentMeetingId);
};

App.deleteTopic = async function (topicId) {
    const ok = await App.confirm(App._t('common.delete'), App._t('topics.deleteConfirm'));
    if (!ok) return;
    const topic = await DB.topics.get(topicId);
    await DB.topics.delete(topicId);
    if (App.currentMeetingId) App.renderMeetingDetail(App.currentMeetingId);
};

App.copyToMeeting = async function (meetingId, topicId) {
    const topic = await DB.topics.get(topicId);
    if (!topic) return;
    // Archive current comentario into historial
    const sourceMeeting = await DB.meetings.get(topic.meetingId);
    const historyEntry = {
        meetingId: topic.meetingId,
        meetingTitulo: sourceMeeting ? sourceMeeting.titulo : 'Acta #' + topic.meetingId,
        fecha: sourceMeeting ? sourceMeeting.fecha : '',
        comentario: topic.comentario || ''
    };
    let historial = [];
    try { historial = JSON.parse(topic.historial || '[]'); } catch (e) {}
    historial.push(historyEntry);
    await DB.topics.add({
        meetingId,
        titulo: topic.titulo,
        resumen: topic.resumen || '',
        resuelto: 0,
        solucion: '',
        comentario: '',
        esPendiente: true,
        historial: JSON.stringify(historial)
    });
    App.renderMeetingDetail(meetingId);
};

App.renderTopics = async function () {
    const meetings = await DB.meetings.toArray();
    const topics = await DB.topics.toArray();
    const filterMeeting = document.getElementById('filter-meeting-topics');
    const filterResolved = document.getElementById('filter-resolved');
    const meetingMap = {};
    meetings.forEach(m => meetingMap[m.id] = m.titulo);

    const mVal = filterMeeting.value;
    filterMeeting.innerHTML = '<option value="">' + App._t('common.allMeetings') + '</option>' +
        meetings.map(m => `<option value="${m.id}">${App.esc(m.titulo)}</option>`).join('');
    filterMeeting.value = mVal;

    const rVal = filterResolved.value;
    filterResolved.innerHTML =
        '<option value="">' + App._t('topics.filterAll') + '</option>' +
        '<option value="0">' + App._t('topics.pending') + '</option>' +
        '<option value="1">' + App._t('topics.resolved') + '</option>';
    filterResolved.value = rVal;

    let filtered = topics;
    if (mVal) filtered = filtered.filter(t => t.meetingId == mVal);
    if (rVal !== '') filtered = filtered.filter(t => t.resuelto == rVal);

    const h = document.getElementById('topics-list');
    if (!filtered.length) {
        h.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F4CB;</div><p>' + App._t('topics.empty') + '</p></div>';
        return;
    }
    h.innerHTML = filtered.map(t => `
        <div class="list-item">
            <div class="item-main">
                <div class="item-title">${App.esc(t.titulo)}</div>
                <div class="item-sub">
                    <span class="item-badge ${t.resuelto ? 'badge-resolved' : 'badge-pending'}">${t.resuelto ? App._t('topics.resolved') : App._t('topics.pending')}</span>
                    ${meetingMap[t.meetingId] ? ' &middot; ' + App.esc(meetingMap[t.meetingId]) : ''}
                    ${t.esPendiente ? ' &middot; <em>' + App._t('topics.dragged') + '</em>' : ''}
                    ${t.resumen ? '<br>' + App.esc(t.resumen) : ''}
                    ${t.comentario ? '<br><span style="font-size:12px;color:var(--text-secondary);">\u2192 ' + App.esc(t.comentario) + '</span>' : ''}
                    ${t.resuelto && t.solucion ? '<br><span style="font-size:12px;color:var(--success);">\u2713 ' + App.esc(t.solucion) + '</span>' : ''}
                </div>
            </div>
            <div class="item-actions">
                <button class="btn secondary small" onclick="App.navTo('meeting-detail', ${t.meetingId})">${App._t('topics.viewMeeting')}</button>
            </div>
        </div>
    `).join('');
};
