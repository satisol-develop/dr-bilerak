// ======================== AUTH ========================

App.login = function () {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) {
        App.alert(App._t('errors.required'), App._t('login.emptyUser'), 'warning');
        return;
    }
    const user = APP_CONFIG.users.find(u => u.username === username && u.password === password);
    if (!user) {
        App.alert(App._t('errors.required'), App._t('login.error'), 'error');
        return;
    }
    App.currentUser = user;
    localStorage.setItem('actas_user', JSON.stringify(user));
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('user-name').textContent = user.nombre;
    App.initApp();
};

App.logout = async function () {
    const ok = await App.confirm(App._t('login.logoutConfirm'), App._t('login.logoutText'));
    if (!ok) return;
    App.currentUser = null;
    localStorage.removeItem('actas_user');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
};

App.checkAuth = function () {
    const saved = localStorage.getItem('actas_user');
    if (saved) {
        try {
            App.currentUser = JSON.parse(saved);
            const valid = APP_CONFIG.users.find(u => u.username === App.currentUser.username);
            if (valid) {
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('app-content').classList.remove('hidden');
                document.getElementById('user-name').textContent = App.currentUser.nombre;
                App.initApp();
                return true;
            }
        } catch (e) { /* ignore */ }
    }
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
    return false;
};
