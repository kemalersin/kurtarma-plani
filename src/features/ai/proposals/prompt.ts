/** AI sistem promptuna eklenen kayıt önerisi format rehberi. */
export const AI_PROPOSAL_GUIDE = `## Kayıt önerisi formatı (zorunlu)

Kullanıcı veri eklemek istediğinde (ekran görüntüsü, tablo, talimat) yanıtına **mutlaka** aşağıdaki JSON bloğunu ekle. Açıklama metni bloğun dışında kalabilir.

\`\`\`kp-proposals
{
  "version": 1,
  "items": [ ... ]
}
\`\`\`

Kurallar:
- \`id\`, \`createdAt\`, \`updatedAt\` **yazma** — uygulama üretir.
- Faiz oranları **ondalık kesir** (4,25 % → \`0.0425\`), yüzde değil.
- Tarihler ISO 8601 (\`2025-03-15\` veya tam ISO).
- Para birimi 3 harf (\`TRY\`); belirtilmezse profil para birimi kullanılır.
- İlişkiler: aynı batch'te \`ref\` + \`*Ref\` alanları; mevcut kayıtlar için \`*Id\` veya \`*Name\` (bankName, accountName …).
- \`loan\` / \`installmentCashAdvance\` için taksit tablosu varsa \`payments\` dizisi ekle (installmentIndex, dueDate, scheduledAmount; ödenmişse paidDate/paidAmount).
- Eksik zorunlu alan varsa JSON üretme; kullanıcıya sor.

Desteklenen \`type\` değerleri ve \`data\` alanları:

| type | Zorunlu data alanları | Opsiyonel / ilişki |
|---|---|---|
| bank | name | shortName, notes |
| account | name, type (checking/savings/fx/other), openingDate | bankId/bankRef/bankName, openingBalance, iban |
| cashRegister | name, openingDate | openingBalance, notes |
| incomeType / expenseType | name | color, notes |
| loan | name, principal, termMonths, startDate, firstInstallmentDate, interestRate, interestPeriod (monthly/annual) | bankId/bankRef/bankName, lateInterestRate, taxRateMonthly, payments[] |
| loanPayment | loanId/loanRef, installmentIndex, dueDate, scheduledAmount | paidDate, paidAmount, lateFee, sourceAccountId/sourceAccountName |
| creditCard | name, limit, statementCutoffDay, paymentDueDay, purchaseAprMonthly | bankId/bankRef/bankName, openingBalance, lateAprMonthly, cashAdvanceAprMonthly |
| creditCardTransaction | cardId/cardRef, date, type (purchase/payment/cashAdvance), amount | description, installmentCount |
| cashAdvanceAccount | name, limit, openingDate, interestRate, interestPeriod | bankId/bankRef/bankName, openingBalance, lateInterestRate |
| cashAdvanceTransaction | accountId/accountRef, date, type (draw/payment), amount | description |
| installmentCashAdvance | name, principal, termMonths, startDate, firstInstallmentDate, interestRate, interestPeriod | bankId/bankRef/bankName, cashAdvanceAccountRef, taxRateMonthly, payments[] |
| installmentCashAdvancePayment | installmentAdvanceId/installmentAdvanceRef, installmentIndex, dueDate, scheduledAmount | paidDate, paidAmount, lateFee |
| income | amount, plannedDate + accountId/accountRef/accountName **veya** cashRegisterId/cashRegisterRef/cashRegisterName | incomeTypeId/incomeTypeName, actualDate, description |
| expense | amount, plannedDate + accountId/accountRef/accountName **veya** cashRegisterId/cashRegisterRef/cashRegisterName | expenseTypeId/expenseTypeName, actualDate, description |
| transfer | amount, date + kaynak (fromAccountId/fromAccountRef/fromAccountName veya fromCashRegister*) + hedef (toAccount* veya toCashRegister*) | description, exchangeRate, targetAmount |

Örnek (taksitli nakit avans + banka):

\`\`\`kp-proposals
{
  "version": 1,
  "items": [
    { "ref": "b1", "type": "bank", "data": { "name": "Garanti BBVA" } },
    {
      "ref": "ica1",
      "type": "installmentCashAdvance",
      "data": {
        "name": "Taksitli nakit avans",
        "bankRef": "b1",
        "principal": 25000,
        "termMonths": 12,
        "startDate": "2025-01-10",
        "firstInstallmentDate": "2025-02-10",
        "interestRate": 0.0425,
        "interestPeriod": "monthly"
      },
      "payments": [
        { "installmentIndex": 1, "dueDate": "2025-02-10", "scheduledAmount": 2145.5 }
      ]
    }
  ]
}
\`\`\``
