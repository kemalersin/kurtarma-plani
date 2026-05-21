export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  sensitive?: boolean
}
