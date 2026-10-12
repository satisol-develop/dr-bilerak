const DB = new Dexie('ActasDB');

DB.version(6).stores({
    groups: '++id,nombre',
    contacts: '++id,nombre,groupId,tipo',
    contact_groups: '++id,contactId,groupId',
    meetings: '++id,fecha,groupId',
    attendance: '++id,meetingId,contactId,groupId',
    topics: '++id,meetingId,resuelto,esPendiente'
});

DB.groups.mapToClass(class Group {
    toString() { return this.nombre; }
});
