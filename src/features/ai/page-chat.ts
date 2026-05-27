import type { RouteLocationNormalized } from 'vue-router'

/** IndexedDB oturum kimliği: `chat:<key>`. */
export function chatSessionStorageId(key: string): string {
  return `chat:${key}`
}

/** Eski tek oturum kaydı — yükseltmede `chat:ai` olarak taşınır. */
export const LEGACY_ACTIVE_CHAT_ID = 'active'

const TAB_QUERY = 'tab'

/**
 * Route adı + isteğe bağlı `?tab=` ile sayfa/sohbet anahtarı.
 * Sekmesiz sayfalarda yalnızca route adı kullanılır.
 */
export function resolveAiChatKey(route: RouteLocationNormalized): string {
  const name = String(route.name ?? 'home')
  const tab = route.query[TAB_QUERY]
  if (typeof tab === 'string' && tab.length > 0) {
    return `${name}:${tab}`
  }
  return name
}

const PLACEHOLDERS: Record<string, string> = {
  home:
    'Net varlık, yaklaşan vadeler ve panel özetleri hakkında soru sorun. Örneğin: "Bu ay ödemem gereken borçlar neler?" veya "Nakit pozisyonum nasıl?"',
  'admin:banks':
    'Banka kayıtlarınızı düzenleme ve kullanım durumunu anlamak için sorular sorun. Örneğin: "Hangi bankalar hesaplarda kullanılıyor?"',
  'admin:accounts':
    'Hesap bakiyeleri, türler ve açılış kayıtları hakkında yardım alın. Örneğin: "Vadesiz hesaplarımın toplam bakiyesi nedir?"',
  'admin:cashRegisters':
    'Kasa kayıtları ve nakit tutma durumunuz hakkında soru sorun. Örneğin: "Kasalardaki toplam nakit ne kadar?"',
  'admin:incomeTypes':
    'Gelir türleri ve sınıflandırma önerileri isteyin. Örneğin: "Gelir türlerimi nasıl gruplayabilirim?"',
  'admin:expenseTypes':
    'Gider türleri ve bütçe kategorileri hakkında soru sorun. Örneğin: "En çok hangi gider türlerine harcıyorum?"',
  admin:
    'Bankalar, hesaplar, kasalar ve gelir/gider türlerinizi yönetirken yardım alın.',
  'debts:loans':
    'Kredi taksit planları, erken kapama ve vade durumu hakkında soru sorun. Örneğin: "Hangi kredilerim gecikmiş?" veya "Erken kapama ne kadar tutar?"',
  'debts:creditCards':
    'Kredi kartı limitleri, ekstre dönemleri ve asgari ödemeler hakkında yardım alın. Örneğin: "Toplam kart borcum ve kullanılabilir limitim nedir?"',
  'debts:cashAdvance':
    'Nakit avans faiz tahakkuku ve ödeme stratejileri hakkında soru sorun. Örneğin: "Nakit avans borcumu nasıl hızlı kapatabilirim?"',
  'debts:installmentAdvance':
    'Taksitli nakit avans planları ve kalan borç hakkında soru sorun. Örneğin: "Taksitli avanslarımın toplam kalan tutarı nedir?"',
  debts:
    'Krediler, kredi kartları ve nakit avans borçlarınızı analiz ettirin veya ödeme planı önerisi isteyin.',
  'cashflow:incomes':
    'Planlı ve gerçekleşmiş gelirlerinizi inceleyin. Örneğin: "Bu ay vadesi geçmiş gelir kayıtlarım var mı?"',
  'cashflow:expenses':
    'Gider kayıtları, vade durumu ve tekrarlayan harcamalar hakkında soru sorun. Örneğin: "Gecikmiş giderlerim neler?"',
  'cashflow:transfers':
    'Hesap ve kasa arası transferlerinizi gözden geçirin. Örneğin: "Son transferlerimde tutarsızlık var mı?"',
  cashflow:
    'Gelir, gider ve transfer planlarınızı değerlendirin; nakit akışı senaryoları sorun.',
  'analytics:debts':
    'Borç analizi grafikleri ve taksit listesi hakkında yorum isteyin. Örneğin: "Önümüzdeki 3 ayda en yüksek taksitler hangileri?"',
  'analytics:cashflow':
    'Nakit akışı grafikleri ve kategori dağılımı hakkında soru sorun. Örneğin: "Gelir-gider dengem son aylarda nasıl?"',
  'analytics:accounts':
    'Hesap hareketleri ve bakiye trendi hakkında yardım alın. Örneğin: "Hangi hesapta en çok hareket var?"',
  analytics:
    'Rapor ve grafiklerinizi yorumlatın; dönem karşılaştırması veya trend analizi isteyin.',
  ai:
    'Borç, nakit akışı ve varlıklarınız hakkında serbest soru sorun. Yanıtlar profil verinize dayanır; hassas kayıtlar modele gönderilmez.',
  'settings:profile':
    'Profil adı ve genel ayarlar hakkında rehberlik alın.',
  'settings:locale':
    'Bölgesel ayarlar (para birimi, tarih formatı, saat dilimi) hakkında soru sorun.',
  'settings:security':
    'Parola ve şifreleme seçenekleri hakkında bilgi alın.',
  'settings:banking':
    'TCMB preset ve bankacılık referans oranları hakkında soru sorun.',
  'settings:ai':
    'AI sağlayıcı yapılandırması, model seçimi ve maliyet takibi hakkında yardım alın.',
  'settings:data':
    'Yedekleme, dışa aktarma ve geri yükleme işlemleri hakkında rehberlik isteyin.',
  'settings:sync':
    'Senkronizasyon ve çakışma çözümü hakkında soru sorun.',
  'settings:updates':
    'Uygulama güncellemeleri hakkında bilgi alın.',
  settings:
    'Uygulama ayarları ve yapılandırma seçenekleri hakkında yardım alın.',
  about:
    'Uygulama özellikleri, veri gizliliği ve kullanım hakkında soru sorun.',
}

const DEFAULT_PLACEHOLDER =
  'Finans verileriniz hakkında soru sorun. Yanıtlar profil verinize dayanır; hassas kayıtlar modele gönderilmez.'

/** Boş sohbet durumunda gösterilecek sayfa özel özet metni. */
export function resolveAiChatPlaceholder(route: RouteLocationNormalized): string {
  const key = resolveAiChatKey(route)
  return PLACEHOLDERS[key] ?? PLACEHOLDERS[String(route.name ?? '')] ?? DEFAULT_PLACEHOLDER
}

/** Tam sayfa AI görünümünde floating düğme gereksiz. */
export function shouldShowAiChatFab(route: RouteLocationNormalized): boolean {
  return route.name !== 'ai'
}
