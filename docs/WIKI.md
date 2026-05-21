# Kurtarma Planı — Proje Wiki (Gereksinimler)

Bu belge, projenin **ilk gereksinim tanımının** eksiksiz ve düzenlenmiş bir kaydıdır. Ürün kapsamı, veri modeli, iş kuralları, analizler, teknik kısıtlar, AI özellikleri, araştırma beklentileri, geliştirici/UI yaklaşımı ve çalışma şeklini tek yerde toplar.

---

## 1. Proje tanımı ve rol

**Kurtarma Planı**, borçları kayıt altına alıp gelir-gider dengesini sağlamaya yarayan bir **statik tek sayfa uygulamasıdır (SPA)**.

Geliştirme perspektifi: projede **kıdemli full-stack geliştirici** olarak çalışılır.

| Özellik | Tanım |
|---------|--------|
| Mimari | Statik SPA; **backend yok** |
| Veri depolama | Tüm veriler **IndexedDB** üzerinde tutulur |
| Dağıtım | Production çıktısı **tek bir statik HTML dosyası** |
| HTML içeriği | Stiller, scriptler, simgeler ve görseller dahil — harici CDN yerine gömülü kullanım veya SVG |
| Çalıştırma | Herhangi bir web sunucusuna veya proxy’ye ihtiyaç duyulmadan, **yalnızca dosyaya tıklanarak** açılabilmeli |
| Çevrimdışı | Mümkün olduğunca **çevrimiçi olmadan** da açılıp hemen kullanılabilmeli |

---

## 2. Güvenlik ve parola

Kullanıcı sayfayı **ilk açtığında** parola tanımlayabilir; parola **zorunlu değildir**.

| Durum | Davranış |
|-------|----------|
| Parola tanımlı | Parola IndexedDB’de **hash’lenerek** saklanır; **diğer tüm veriler** bu parolayla şifrelenir |
| Parola tanımsız | Veriler şifrelenmeden saklanabilir (ilk tanımda parola opsiyonel olduğu belirtilmiştir) |
| Parola değişimi | Veriler **yeni parolayla yeniden şifrelenmelidir** |

---

## 3. Veri modeli — kayıt türleri

Aşağıdaki veriler uygulamaya girilebilmelidir. Numaralandırma, orijinal gereksinim yapısına sadık kalınarak korunmuştur.

### 3.1 Bankalar ve bankacılık ürünleri

#### 1. Bankalar

| Alt öğe | Açıklama |
|---------|----------|
| **1.a** | Banka hesapları |
| **1.a.a** | Banka hesabı açılış bakiyesi |
| **1.b** | Krediler |
| **1.b.a** | Kredi borçları |
| **1.c** | Kredi kartları |
| **1.c.a** | Kredi kartı limiti |
| **1.c.b** | Kredi kartı açılış bakiyesi |
| **1.c.c** | Kredi kartı borçları |
| **1.d** | Nakit avans |
| **1.d.a** | Nakit avans limiti |
| **1.d.a** *(ikinci madde)* | Nakit avans hesabı açılış bakiyesi |
| **1.d.b** | Nakit avans kullanımı *(tekil)* |
| **1.e** | Taksitli nakit avans *(nakit avans hesabına bağlı)* |
| **1.e.a** | Taksitli nakit avans borçları *(aylık)* |

> **Not:** Orijinal tanımda `1.d.a` altında hem limit hem açılış bakiyesi listelenmiştir; uygulama tasarımında bunlar ayrı alanlar olarak modellenmelidir.

#### Yönetimsel veri sınıfı

Şunlar **yönetimsel veri** olarak kabul edilir:

- Bankalar
- Hesaplar
- Kredi kartları
- Kasalar

---

### 3.2 Gelirler

| Alt öğe | Açıklama |
|---------|----------|
| **2.a** | Gelir türleri — kullanıcı yönetimsel olarak tanımlar; veritabanından **parametrik seçim** |
| **2.b** | Anlık gelir girişi — nakit veya banka hesabına |
| **2.c** | Beklenen gelir girişi |

**Gelir hedefleri:** Gelirler **kasaya** veya **banka hesabına** girilebilir.

**Gelir türleri:** Yönetimsel ve parametrik birer **liste sabiti**dir.

**Önemli analiz verisi:** Anlık veya **hedeflenen** nakit bakiyenin, belirli bir tarih aralığında veya vadede ödenmesi gereken borçların **ne kadarını karşılayabileceği**.

**Planlanan gelir — vade davranışı:**

- Vadesi **gelirse** veya **geçerse** kullanıcı **uyarılmalı**
- Kullanıcıdan **gerçekleşti / gerçekleşmedi** olarak işaretlemesi istenmelidir

---

### 3.3 Giderler

| Alt öğe | Açıklama |
|---------|----------|
| **3.a** | Gider türleri — kullanıcı yönetimsel olarak tanımlar; veritabanından **parametrik seçim** |
| **3.b** | Anlık gider girişi — nakit veya hesaptan |
| **3.c** | Planlanan gider girişi |

**Gider kaynakları:** Giderler **kasadan** veya **banka hesabından** çıkabilir.

**Transfer:** Bir kasadan veya hesaptan çıkan para **başka bir kasaya** veya **hesaba** girebilir.

**Gider türleri:** Yönetimsel ve parametrik birer **liste sabiti**dir.

**Önemli analiz verisi:** Anlık veya **planlanan** nakit giderin, belirli bir tarih aralığında veya vadede ödenmesi gereken borçları **ne kadar etkileyebileceği**.

**Planlanan gider — vade davranışı:**

- Vadesi **gelirse** veya **geçerse** kullanıcı **uyarılmalı**
- Kullanıcıdan **gerçekleşti / gerçekleşmedi** olarak işaretlemesi istenmelidir

---

## 4. Ürün bazlı iş kuralları ve hesaplamalar

### 4.1 Krediler

Krediler şu bilgilerle oluşturulur:

- Kredi tutarı
- Başlangıç tarihi
- Taksit sayısı
- Kredi faiz oranı (**aylık** veya **yıllık**)
- Gecikme faiz oranı

**Amaç:** İleriki borç hesaplamalarında kullanılmak üzere **her ay ödenmesi gereken tutar** hesaplanmalıdır.

**Gecikme:** Ödenmemiş borçlara **gecikme faizi yansıtılmalıdır**.

---

### 4.2 Kredi kartları

Kredi kartları şu bilgilerle oluşturulur ve güncellenir:

- Limit
- Bakiye
- Asgari ödeme oranı
- Gecikme faizi oranları

**Dönem hareketleri:** Güncel dönem ve **gelecek dönem** hareketleri girilebilir.

**Amaç:** İleriki borç hesaplamalarında kullanılmak üzere **her ay ödenmesi gereken tutar** hesaplanmalıdır.

**Ödeme:** Kredi kartına **herhangi bir tarihte** **tam** veya **kısmi** ödeme yapılabilmelidir.

**Gecikme ve öngörü:**

- Ödenmemiş borçlara ileride **gecikme faizi yansıtılmalıdır**
- Borç ödenmezse **ne kadar artacağı**, **öngörü analizi** ile belirlenmelidir

---

### 4.3 Nakit avans hesabı

Nakit avans hesabı şu bilgilerle oluşturulur:

- Limit
- Bakiye
- Aylık faiz oranı
- Gecikme faiz oranı

**Kullanım:** Nakit avans kullanımları, ileriki borç hesaplamalarında kullanılmak üzere **hesaba yansıtılır**.

**Ödeme:** Nakit avans hesabına **herhangi bir tarihte** **tam** veya **kısmi** ödeme yapılabilmelidir.

**Faiz mantığı:** Nakit avans, borcun **ödenen kısmı (değişken tutar) düşülünce**, kalan borç üzerinden **faizlendirilir**.

---

### 4.4 Taksitli nakit avans

Taksitli nakit avanslar şu bilgilerle oluşturulur:

- Avans tutarı
- Başlangıç tarihi
- Taksit sayısı
- Kredili mevduat faiz oranı (**aylık** veya **yıllık**)
- Gecikme faiz oranı

**Bağlantı:** Nakit avans **hesabına bağlıdır** (bkz. 1.e).

**Amaç:** İleriki borç hesaplamalarında kullanılmak üzere **her ay ödenmesi gereken tutar** hesaplanmalıdır.

**Gecikme ve öngörü:**

- Ödenmemiş borçlara ileride **gecikme faizi yansıtılmalıdır**
- Borç ödenmezse **ne kadar artacağı**, **öngörü analizi** ile belirlenmelidir

**Taksit ödeme durumu:**

- Avans taksitleri **gününde** veya **gecikmeli** olarak **ödendi** olarak işaretlenebilir
- Kalan borcun tamamı, **faizden arındırılmış** olarak **tek seferde kapatılabilir**

---

## 5. Analizler ve raporlama

Bu veriler ışığında aşağıdaki analizler üretilebilmelidir. Liste **ileride çeşitlendirilebilir**; çıktılar **liste veya grafik** formatında olabilir; **Excel / PDF** gibi dosyalara aktarım **ileride** eklenebilir.

| # | Analiz |
|---|--------|
| 1 | Belirli **tarihlerde** veya **tarih aralıklarında** ödenmesi gereken borçlar |
| 2 | Ayrı ayrı veya **toplu** olarak: kredi, kredi kartı, avans hesabı, taksitli nakit avans **kalan borcu** |
| 3 | **Gecikmiş borçlar**; bu borçlara yansıyan **faiz** ve **gecikme tutarları** |
| 4 | Ödenmemiş borcun üzerinden geçen süreye göre **riskli hesaplar** |
| 5 | Belli bir borcu, belirli bir **tarihte tamamen kapatmak** için yapılması gereken **ödeme tutarı** *(vadeye, aylık/yıllık faiz oranına ve kalan borca göre hesaplanır)* |
| 6 | Belirli tarihlerde veya tarih aralıklarında elde edilen **gelirler toplamı** |
| 7 | Belirli tarihlerde veya tarih aralıklarında **giderler toplamı** |
| 8 | Belirli tarihlerde veya tarih aralıklarında **planlanan gelirler toplamı** |
| 9 | Belirli tarihlerde veya tarih aralıklarında **planlanan giderler toplamı** |

---

## 6. Veri dışa aktarma ve içe aktarma

IndexedDB’deki **tüm veri**, snapshot haline getirilip **dışa aktarılabilmelidir**.

| Özellik | Gereksinim |
|---------|------------|
| Dosya şifreleme | Kullanıcı isterse veri dosyasını **şifreleyebilir** |
| Şifresiz kayıt | Kullanıcı isterse **şifresiz** olarak kaydedebilir |
| Şifreli içe aktarım | Şifreli aktarılmış dosya içeri alınırken **önce şifre girilmelidir** |
| Sürüm kontrolü | İçeri alınan dosyanın **versiyonu kontrol edilmelidir** |
| Tutarlılık | Veri alanları **tutarlılığı onaylanmalıdır** |

---

## 7. AI asistan ve analist

Uygulamada **AI asistanı** ve **analist** bulunmalıdır. İletişim **Stream API** üzerinden yapılır.

### 7.1 Sohbet arayüzü

- Bir **sohbet penceresi** eklenmelidir
- Sayfa her yenilendiğinde, sohbet balonuna tıklanırsa sohbet **kaldığı yerden devam eder**
- Sohbet **temizlense bile** kullanım verileri **kalıcı** olmalıdır

### 7.2 Provider ve model yönetimi

Provider ve model seçimi **yönetimsel veridir**. Yapılandırmada şunlar yer alır:

- API Key
- Gerekirse **base URL**

**Desteklenmesi gereken provider’lar:**

| Provider | Ortam |
|----------|--------|
| Anthropic | Bulut |
| OpenAI | Bulut |
| Gemini | Bulut |
| DeepSeek | Bulut |
| Ollama | Yerel |
| VLLM | Yerel |

### 7.3 Model kataloğu ve maliyet (models.dev)

- İlgili provider’lara ait **kullanılabilir modeller** ve **kullanım ücretleri**, [models.dev](https://models.dev) adresindeki web sitesinden alınmalıdır
- Bu veri **koda gömülmelidir**: build alınırken bir **derleme anahtarıyla** anlık olarak güncel model listesi çekilip **embed** edilir

### 7.4 Kullanım takibi ve sohbet kaydı

**Sohbet penceresinde gösterilecekler:**

- Anlık **token kullanımı**
- Anlık **maliyet**

**Kayıt altına alınacaklar:**

- Kullanım verileri
- Sohbet geçmişi

**Kullanım verilerinde gösterilebilecek değerler:**

- Input token sayısı
- Output token sayısı
- Cache’lenmiş token kullanımı
- Cache hariç token kullanım maliyeti

### 7.5 Sistem promptu ve veri erişimi

- AI model API’sine **sistem promptu** olarak, kısa açıklamalarla birlikte **IndexedDB veritabanı snapshot** gönderilir
- AI modeli, sistem prompt’a eklenmiş **serileştirilmiş veri setinden** her türlü **analizi** yapabilmelidir

---

## 8. Başlamadan önce yapılması gerekenler

**21 Mayıs 2026** itibarıyla **Türkiye** için geçerli olmak üzere:

### 8.1 Bankacılık sistemi araştırması

- Bankacılık sistemi genel çerçevesi
- Banka hesabı, kredi, kredi kartı, nakit avans, taksitli nakit avans
- Borç, ödeme/tahsilat mevzuatı
- Kullanım koşulları
- Yaptırımlar, idari cezalar
- Hükümlülükler ve yükümlülükler
- Bankacılık sisteminde **vade**, **faiz** ve benzeri **finansal hesaplamalar**

### 8.2 Teknik karar araştırmaları

- **Tech stack** seçimi
- Statik çalışmayı ve web sunucusuna ihtiyaç duymamayı destekleyen yapı
- Finansal SPA arayüzleri için en uygun **UI kit** kararı
- **models.dev** araştırması

> Bu araştırmalar tamamlandıktan sonra tech stack, UI kit ve benzeri temel konular **birlikte** netleştirilir.

---

## 9. Geliştirici ve UI/UX yaklaşımı

### 9.1 Mimari ve kod kalitesi

- **Modüler** yapı
- **Kütüphane odaklı** tasarım
- **Tekrar kullanılabilir** bileşenler
- Kod tekrarını **en aza indiren** mimari

### 9.2 Kullanılabilirlik

- **Sezgisel** ve **esnek** arayüz
- **Kolay kullanım**
- Karmaşık ve **dağınık olmayan** yerleşim

### 9.3 Görünüm ve cihaz desteği

- **Mobile-first**
- **Responsive**
- **Açık / karanlık** tema desteği
- **Finansal kullanım** odaklı UI/UX

### 9.4 Kabuk ve gezinme

| Bileşen | Gereksinim |
|---------|------------|
| Sol menü | Açılıp kapanabilir; **sabitlenebilir (pin)** |
| Üst navbar | **Global arama** özelliğini destekler |
| Formlar | **Drawer** şeklinde açılır |

### 9.5 Drawer ve combobox etkileşimi

- Bir öğe **combobox** benzeri liste bileşeninden seçiliyorsa, o listede **「Yeni Kayıt」** düğmesine tıklanarak ilgili kayıt formu, **var olan drawer’ın üstüne** açılabilmelidir

### 9.6 Liste odaklı arayüz

- **Liste öncelikli** arayüz
- Tüm listelerde: **sıralama**, **sayfalama**, **arama**, **filtreleme**

### 9.7 Grafikler ve rapor sayfaları

- Önemli veriler **grafiklerle** desteklenmeli
- **Özel grafiksel analiz** ve **rapor sayfaları** olmalı

### 9.8 Bölgesel biçimlendirme

Tüm bölgesel biçimlendirmeler **Türkiye sistemine özel** olmalıdır:

- Miktarlar ve tutarlar
- Tarihler
- Diğer yerel formatlar

**Saat dilimi:** **İstanbul** kabul edilir.

---

## 10. Çalışma şekli ve süreç

Aşağıdaki sıra izlenir:

| Adım | İş |
|------|-----|
| 1 | **Önce planlama** yapılır |
| 2 | Her milestone **fazlara bölünebilir** |
| 3 | Planlanan ve tamamlanan görevler **ayrı ayrı dökümante** edilir (`TODO` / `CHANGELOG`) |
| 4 | Önemli noktalar, çalışma şekli, geliştirici ve UI/UX yaklaşımları **kural / SKILL** haline getirilir |
| 5 | Planlama ve araştırmalar sonrası tech stack, UI kit vb. **onaya sunulur** |
| 6 | Onay sonrası **README** başta olmak üzere belgeler oluşturulur |
| 7 | Kurallar ve SKILL’ler belirlenir; **son kez onay** alınır |
| 8 | Onaydan sonra **geliştirmeye geçilir** |

Geliştirici, netleştirme gerektiren konularda kullanıcıdan **girdi toplayabilir**.

---

## 11. Wiki kapsam notu

Bu Wiki yalnızca **ilk prompt**taki gereksinimleri içerir. Sohbet içinde sonradan eklenen netleştirmeler (çoklu profil, hassas veri, TCMB preset yaşam döngüsü, çevrimiçi/çevrimdışı AI ayrımı, **UI kit kararı: Ant Design Vue 4 / Tailwind yok** vb.) için bkz.:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`BANKING-TR.md`](./BANKING-TR.md)
- [`../CHANGELOG.md`](../CHANGELOG.md)

**Geliştirici / UI yaklaşımı (§9–10) kuralları:**

- [`.cursor/rules/developer-ux.mdc`](../.cursor/rules/developer-ux.mdc) — alwaysApply
- [`.cursor/rules/ui-patterns.mdc`](../.cursor/rules/ui-patterns.mdc) — Vue dosyalarında
- [`.cursor/skills/kurtarma-plani/SKILL.md`](../.cursor/skills/kurtarma-plani/SKILL.md)

---

*Son güncelleme: ilk gereksinim tanımının Wiki’ye aktarımı.*
