export type AdminRow = Record<string,unknown>;
export type InviteLink = {guestId:string;guest:string;invitationUrl:string};
export type AdminResult = {error?:string;inviteUrl?:string;guestId?:string;giftId?:string;links?:InviteLink[];skipped?:number;message?:string};
export type AdminAction = (op:string,values:Record<string,unknown>) => Promise<AdminResult|null>;
export const rowText = (value:unknown) => String(value ?? '');
