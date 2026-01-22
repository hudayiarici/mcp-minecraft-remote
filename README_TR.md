[![smithery badge](https://smithery.ai/badge/@hudayiarici/mcp-minecraft-remote)](https://smithery.ai/server/@hudayiarici/mcp-minecraft-remote)


# MCP Minecraft Remote (MCP Minecraft Uzaktan Kontrol)

> Bu proje arjunkmrm tarafından geliştirilen [mcp-minecraft](https://github.com/arjunkmrm/mcp-minecraft) projesinden esinlenilmiştir. Orijinal proje sadece yerel Minecraft sunucu bağlantılarını desteklerken, bu proje uzak Minecraft sunucularına bağlantı desteği eklemek üzere sıfırdan oluşturulmuştur.

MCP (Model Bağlam Protokolü) kullanarak Minecraft Uzaktan Kontrolü.

## Özellikler

- Bir yapay zeka asistanı aracılığıyla Minecraft oyuncusunu bağlayın ve kontrol edin
- Minecraft dünyasında gezinin, maden kazın, inşa edin ve etkileşim kurun
- Sunucudaki diğer oyuncularla sohbet edin
- Envanteri, oyuncu konumunu ve sunucu bilgilerini kontrol edin
- Zıplama, eğilme ve koşma dahil gelişmiş hareket kontrolü
- Saldırma ve takip etme dahil varlık etkileşimi
- Konteyner kullanımı (sandıklar, fırınlar vb.)
- Eşya üretimi ve köylü ticareti
- Detaylı envanter yönetimi

### Akıllı Özellikler ve Otonom Yetenekler

- **Sıkışma Tespiti ve Kurtarma:** Bot hareket halindeyken sıkıştığını zekice tespit eder. Eğer ilerleme kaydedemezse işlemi iptal eder ve çözümler önerir (zıplama, kazma).
- **Ölüm Yönetimi:** Bot bir görev sırasında ölürse hemen durur, ölüm konumunu raporlar ve kendini bozuk bir duruma girmekten korur.
- **Akıllı Hareket:** 
  - `moveToPlayer`: Belirli bir oyuncunun hareketli konumunu dinamik olarak bulup yanına gidebilir.
  - Hareket etmeden önce sohbette oyunculara bildirim gönderme özelliği (duyuru) içerir.
- **Otomatik Yemek (Hayatta Kalma):** `eat` aracı açlığı akıllıca yönetir. Açlık doluysa yemeği israf etmez ve envanterden en uygun yiyeceği otomatik olarak seçer.
- **Akıllı Kaynak Toplama:** `collectBlocks` aracı "Damar Kazma" (Vein Mining) mantığını kullanır. Bir ağacı keserken veya maden damarını kazarken, körü körüne dünyayı aramak yerine akıllıca bitişik blokları (ağaçlar için dikey öncelikli) kontrol eder, bu da onu çok daha verimli hale getirir.

## Kurulum

### Smithery ile Kurulum

Minecraft Remote Control'ü Claude Desktop için [Smithery](https://smithery.ai/server/@hudayiarici/mcp-minecraft-remote) aracılığıyla otomatik olarak kurmak için:

```bash
npx -y @smithery/cli install @hudayiarici/mcp-minecraft-remote --client claude
```

### Hızlı Kurulum (Önerilen)

```bash
npx -y @smithery/cli install mcp-minecraft-remote --client claude
```

Kurulumu tamamlamak için CLI komutlarını takip edin.

### Manuel Kurulum

```bash
# npm'den kurulum
npm install -g mcp-minecraft-remote

# Veya depoyu klonlayın
git clone https://github.com/hudayiarici/mcp-minecraft-remote.git
cd mcp-minecraft-remote

# Bağımlılıkları yükleyin
npm install

# Projeyi derleyin
npm run build
```

## Kullanım

### Claude Desktop ile Kullanım

1. Claude Desktop yapılandırma dosyasına gidin:

   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Minecraft Remote MCP yapılandırmasını dosyanıza ekleyin:

```json
{
  "mcpServers": {
    "minecraft-remote": {
      "command": "npx",
      "args": ["-y", "mcp-minecraft-remote@latest"]
    }
  }
}
```

Eğer global olarak kurduysanız:

```json
{
  "mcpServers": {
    "minecraft-remote": {
      "command": "mcp-minecraft-remote"
    }
  }
}
```

Eğer depoyu yerel olarak klonladıysanız:

```json
{
  "mcpServers": {
    "minecraft-remote": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-minecraft-remote/build/index.js"]
    }
  }
}
```

3. Dosyayı kaydedin ve Claude Desktop'ı yeniden başlatın
4. Claude ile yeni bir konuşma başlatın ve Minecraft kontrol komutlarını kullanmaya başlayın

### Önemli Sunucu Gereksinimleri

- **Sunucu Online Modu:** Minecraft sunucusunun `server.properties` dosyasında `online-mode=false` ayarı yapılmış olmalıdır. Bu, botun Minecraft oturum sunucularına kimlik doğrulaması yapmadan bağlanmasını sağlar.
- Eğer kimlik doğrulamalı (premium) bir sunucu kullanıyorsanız, bağlanırken geçerli premium hesap bilgilerinizi sağlamanız gerekir.

### Mevcut Araçlar

#### Temel İşlevsellik

- `connectToServer`: Belirtilen kimlik bilgileriyle bir Minecraft sunucusuna bağlan
- `disconnectFromServer`: Minecraft sunucusuyla bağlantıyı kes
- `sendChat`: Sunucuya bir sohbet mesajı gönder
- `getServerInfo`: Bağlı sunucu hakkında bilgi al

#### Hareket

- `getPosition`: Mevcut oyuncu konumunu al
- `moveTo`: Belirli koordinatlara git
- `moveControl`: Temel hareket kontrolleri (ileri, geri, sol, sağ, zıpla, koş, eğil, dur)
- `lookAt`: Oyuncunun belirli bir yöne veya koordinata bakmasını sağla

#### Dünya Etkileşimi

- `digBlock`: Belirli koordinatlardaki bir bloğu kaz
- `placeBlock`: Belirli koordinatlara bir blok yerleştir
- `collectBlocks`: "Damar kazma" mantığını kullanarak (bağlantılı blokları takip eder) belirli türdeki blokları (örn. "oak_log") akıllıca topla.

#### Envanter Yönetimi

- `checkInventory`: Temel envanter kontrolü
- `inventoryDetails`: Envanter öğeleri hakkında detaylı bilgi al
- `equipItem`: Envanterden ele veya zırh yuvasına bir eşya kuşan
- `tossItem`: Envanterden eşya at

#### Varlık Etkileşimi

- `getNearbyPlayers`: Yakındaki oyuncuların listesini al
- `getNearbyEntities`: Yakındaki tüm varlıkların listesini al
- `attackEntity`: Belirli bir varlığa saldır
- `useOnEntity`: Tutulan eşyayı belirli bir varlık üzerinde kullan
- `followEntity`: Belirli bir varlığı takip et

#### Konteyner Etkileşimi

- `openContainer`: Belirli koordinatlardaki bir konteyneri (sandık, fırın vb.) aç
- `withdrawItem`: Açık konteynerden eşya al
- `depositItem`: Açık konteynere eşya koy
- `closeContainer`: Şu anda açık olan konteyneri kapat

#### Üretim (Crafting)

- `getRecipes`: Mevcut üretim tariflerinin listesini al
- `craftItem`: Mevcut malzemeleri kullanarak bir eşya üret

#### Ticaret

- `listTrades`: Yakındaki bir köylüden mevcut takasları listele
- `tradeWithVillager`: Yakındaki bir köylüyle ticaret yap

### Örnek Komutlar

#### Temel Kontroller

- "play.example.com adresindeki Minecraft sunucusuna player1 kullanıcı adıyla bağlan"
- "Oyundaki mevcut konumum nedir?"
- "Beni x=100, y=64, z=-200 koordinatlarına taşı"
- "3 saniye boyunca ileri yürümemi sağla"
- "O dağa doğru zıplayıp koşmamı sağla"

#### Envanter ve Eşyalar

- "Envanterimde ne olduğunu detaylı kontrol et"
- "Elmas kılıcımı elime al"
- "Envanterimden 5 toprak bloğu at"

#### Blok Etkileşimi

- "x=10, y=65, z=20 koordinatlarındaki bloğu kaz"
- "x=11, y=65, z=20 koordinatlarına bir taş blok yerleştir"

#### Varlık Etkileşimi

- "Yakında başka oyuncu var mı?"
- "Bana 20 blok mesafedeki varlıklar neler?"
- "12345 ID'li zombiye saldır"
- "Steve isimli oyuncuyu takip et"

#### Konteyner Kullanımı

- "x=100, y=64, z=200 koordinatlarındaki sandığı aç"
- "Sandıktan 10 demir külçesi al"
- "Sandıga 5 kırıktaş koy"
- "Konteyneri kapat"

#### Üretim ve Ticaret

- "Tahta kazma için hangi tariflere sahibim?"
- "Envanterimdeki odunu kullanarak 4 çubuk üret"
- "Yakındaki köylünün sunduğu takasları kontrol et"
- "10 zümrüt almak için köylüyle ticaret yap"

#### İletişim

- "Sohbete bir merhaba mesajı gönder"
- "Herkese elmas bulduğumu söyle"

## Gereksinimler

- Node.js 18+
- MCP destekleyen bir yapay zeka asistanı (Claude gibi)
- Bir Minecraft Java Edition sunucusu (sürüm 1.8 veya sonrası)

**Not**: Bu araç özellikle vanilla Minecraft 1.21 ile çalışacak şekilde test edilmiş ve doğrulanmıştır. Diğer sürümlerle veya modlu sunucularla çalışabilse de, uyumluluk garanti edilmez.

## Lisans

MIT
