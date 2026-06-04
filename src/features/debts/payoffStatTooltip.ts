/** Taksit planı «Erken kapama (bugün)» istatistik etiketi tooltip metni. */
export function payoffStatTooltip(earlyPayoffWithoutInterest?: boolean): string {
  if (earlyPayoffWithoutInterest) {
    return 'Tahmini erken kapama: kalan taksit borcu − vadesi gelmemiş taksitlerin plan faiz/vergisi. Sözleşmeniz erken kapamada faiz uygulamıyorsa banka tutarı daha düşük olabilir. Komisyon dahil değildir.'
  }
  return 'Tahmini erken kapama: kalan taksit borcu − vadesi gelmemiş taksitlerin plan faiz/vergisi (gelecek taksit faizi ödenmez). Tüm kalan taksitler gecikmişse kalan borca eşit olur. Banka komisyonu dahil değildir.'
}
