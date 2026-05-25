/** Taksit planı «Erken kapama (bugün)» istatistik etiketi tooltip metni. */
export function payoffStatTooltip(earlyPayoffWithoutInterest?: boolean): string {
  if (earlyPayoffWithoutInterest) {
    return 'Tahmini erken kapama: kalan anapara + biriken gecikme faizi. Sözleşmeniz erken kapamada faiz uygulamıyorsa yalnızca bu kalemler hesaplanır. Banka komisyonu dahil değildir; bağlayıcı tutar için ekstrenize bakın.'
  }
  return 'Tahmini erken kapama: kalan anapara + kısmi dönem faizi + biriken gecikme faizi. Gecikmiş taksit varsa vadesi geçmiş faiz ve gecikme faizi eklenir. Banka komisyonu dahil değildir; bağlayıcı tutar için ekstrenize bakın.'
}
