import type { Account, CashRegister } from '@/core/types/entities'
import { D, roundMoney } from '@/finance/decimal'
import type { AccountMovement } from './movements'

/**
 * Bir hesabın `asOf` (varsayılan: şimdi) anındaki bakiyesi.
 *   açılış + Σ(hesabı etkileyen, asOf'a kadar gerçekleşmiş hareketler)
 *
 * Hareket listesi `collectMovements()` ile tüm gelir/gider/transfer + borç
 * ödemeleri/çekimleri için ortak şekilde üretilir.
 */
export function accountBalance(
  account: Account,
  movements: AccountMovement[],
  asOf?: string,
): string {
  const limit = asOf ?? new Date().toISOString()
  let balance = D(account.openingBalance ?? 0)
  for (const m of movements) {
    if (m.accountId !== account.id) continue
    if (m.date > limit) continue
    balance = balance.plus(m.amount)
  }
  return roundMoney(balance).toString()
}

/** Bir kasanın bakiyesi — `accountBalance` ile aynı kanonik akış. */
export function cashRegisterBalance(
  register: CashRegister,
  movements: AccountMovement[],
  asOf?: string,
): string {
  const limit = asOf ?? new Date().toISOString()
  let balance = D(register.openingBalance ?? 0)
  for (const m of movements) {
    if (m.cashRegisterId !== register.id) continue
    if (m.date > limit) continue
    balance = balance.plus(m.amount)
  }
  return roundMoney(balance).toString()
}

/** Tüm hesap + kasaların toplam gerçekleşmiş bakiyesi (profil para birimi varsayımı). */
export function totalCashOnHand(
  accounts: Account[],
  registers: CashRegister[],
  movements: AccountMovement[],
  asOf?: string,
): string {
  let total = D(0)
  for (const a of accounts) total = total.plus(accountBalance(a, movements, asOf))
  for (const r of registers)
    total = total.plus(cashRegisterBalance(r, movements, asOf))
  return roundMoney(total).toString()
}
