import {createHash} from 'node:crypto';
export function notificationIdentity(alert){return createHash('sha256').update(JSON.stringify([alert.character_id,alert.kind,alert.den_id??null,alert.event_key??alert.operation_id??alert.expires??alert.message])).digest('hex');}
