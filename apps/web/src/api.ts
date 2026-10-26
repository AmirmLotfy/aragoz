import type { BossRecipe, EncounterEvent, PrivateRoomState, RoomState, SessionInfo, ShowAction } from '@aragoz/contracts';
import { PrivateRoomStateSchema, RoomStateSchema, ShowbillSchema } from '@aragoz/contracts';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
let csrf = '';
export interface ConnectionInfo { connected:boolean; chatHelpGranted:boolean; testCode:string|null; lastTestAt:number|null; }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'The backstage connection could not complete that action.');
  return body as T;
}
export const api = {
  async session(): Promise<SessionInfo> { const s = await request<SessionInfo>('/session'); csrf = s.csrfToken; return s; },
  connection: () => request<ConnectionInfo>('/connection'),
  testConnection: () => request<ConnectionInfo>('/connection/test', { method:'POST',body:'{}' }),
  shows: () => request('/shows').then(data=>RoomStateSchema.array().parse(data)),
  createShow: () => request('/shows', { method: 'POST', body: '{}' }).then(data=>RoomStateSchema.parse(data)),
  room: (id: string) => request('/shows/' + encodeURIComponent(id)).then(data=>RoomStateSchema.parse(data)),
  backstage: (id: string) => request('/shows/' + encodeURIComponent(id) + '/backstage').then(data=>PrivateRoomStateSchema.parse(data)),
  action: (room: RoomState, action: ShowAction) => request('/shows/' + encodeURIComponent(room.showId) + '/actions', { method: 'POST', body: JSON.stringify({ expectedRevision: room.revision, action }) }).then(data=>RoomStateSchema.parse(data)),
  events: (room: RoomState, clientId: string, events: EncounterEvent[]) => request('/shows/' + encodeURIComponent(room.showId) + '/events', { method: 'POST', body: JSON.stringify({ expectedRevision: room.revision, clientId, events }) }).then(data=>RoomStateSchema.parse(data)),
  showbill: (id: string) => request('/shows/' + encodeURIComponent(id) + '/showbill').then(data=>ShowbillSchema.parse(data)),
  disconnect: () => request('/auth/twitch/disconnect', { method: 'POST', body: '{}' }),
  async deleteShow(id:string){const result=await request('/shows/'+encodeURIComponent(id),{method:'DELETE'});try{localStorage.removeItem('aragoz.outbox.'+id);}catch{/* Server deletion already succeeded. */}return result;},
};
