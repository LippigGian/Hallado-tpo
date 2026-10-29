import { api } from './api';
export async function getMyProfile() { return (await api.get('/profiles/me')).data.profile; }
export async function saveMyProfile(data) { return (await api.patch('/profiles/me', data)).data.profile; }
export async function getPublicProfile(userId) { return (await api.get(`/profiles/${encodeURIComponent(userId)}`)).data.profile; }
export function photoUri(path) { return path ? `${api.defaults.baseURL.replace(/\/$/,'')}${path}` : null; }
