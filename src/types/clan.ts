export interface CreateClanInviteParams {
  clanId: string
  label?: string
  expiresInDays?: number | null // null = permanent
  maxUses?: number | null // null = unlimited
}
