// ======================== UTILITIES ========================

App.esc = function (str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

App.showSnackbar = function (message, type) {
    type = type || 'error';
    const el = document.getElementById('snackbar');
    el.textContent = message;
    el.className = 'snackbar snackbar-' + type + ' show';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
        el.classList.remove('show');
    }, 3500);
};

App.showModal = function (title, bodyHtml, footerHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml || '';
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
};

App.closeModal = function () {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
    App.editingId = null;
    if (App._tsContactGroups) {
        App._tsContactGroups.destroy();
        App._tsContactGroups = null;
    }
    if (App._tsMeetingGroup) {
        App._tsMeetingGroup.destroy();
        App._tsMeetingGroup = null;
    }
    if (App._tsMeetingTipo) {
        App._tsMeetingTipo.destroy();
        App._tsMeetingTipo = null;
    }
};

App.toggleNav = function () {
    document.getElementById('side-nav').classList.toggle('hidden');
    document.getElementById('modal-overlay').classList.toggle('hidden');
};

// SweetAlert wrappers
App.alert = function (title, text, icon) {
    return Swal.fire({
        title: title,
        text: text,
        icon: icon || 'info',
        confirmButtonText: App._t('common.accept'),
        confirmButtonColor: '#475569',
        background: '#1e293b',
        color: '#f1f5f9'
    });
};

App.confirm = async function (title, text) {
    const result = await Swal.fire({
        title: title,
        text: text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: App._t('common.yes'),
        cancelButtonText: App._t('common.no'),
        confirmButtonColor: '#475569',
        background: '#1e293b',
        color: '#f1f5f9'
    });
    return result.isConfirmed;
};

App.toast = function (title, icon) {
    Swal.fire({
        title: title,
        icon: icon || 'success',
        toast: true,
        position: 'bottom',
        showConfirmButton: false,
        timer: 2500,
        background: '#1e293b',
        color: '#f1f5f9'
    });
};
