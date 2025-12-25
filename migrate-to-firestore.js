const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./atmosfercafe-firebase-adminsdk-fbsvc-ccfedce55e.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Menü verilerini buraya yapıştırıyoruz
const menuData = [
  {
    id: 'hizli_sicaklar',
    title: 'Hızlı Sıcaklar',
    icon: 'bi-cup-hot-fill',
    items: [
      { name: 'Bardak Çay', desc: 'Sıcak çay bardakta', img: 'img/cay.png' },
      { name: 'Kupa Çay', desc: 'Büyük fincan çay', img: 'img/kupacay.png' },
      { name: 'Limonlu Çay', desc: 'Çay + taze limon', img: 'img/limonlucay.png' },
      { name: 'Yeşil Çay', desc: 'Sağlıklı yeşil çay', img: 'img/yesilcay.png' },
      { name: 'Kupa Çay (Bergamot)', desc: 'Bergamot aromalı çay', img: 'img/bergomatcay.png' },
      { name: 'Limonlu Çay (Bergamot)', desc: 'Bergamot + limon', img: 'img/bergamotlimonlucay.png' },
      { name: 'Bitki Çayı', desc: 'Doğal bitki karışımı', img: 'img/bitkicayi.png' },
      { name: 'Atom Çayı', desc: 'Özel atom çay karışımı', img: 'img/atomcayi.png' },
      { name: 'Süt', desc: 'Sıcak süt', img: 'img/sut.png' },
      { name: 'Chai Tea Latte', desc: 'Chai çayı sütlü', img: 'img/chaite.png' },
      { name: 'Sıcak Çikolata', desc: 'Kremalı sıcak çikolata', img: 'img/sicakcikolata.png' },
      { name: 'Sahlep', desc: 'Tarçınlı sıcak sahlep', img: 'img/sahlep.png' }
    ]
  },
  {
    id: 'sicak_kahveler',
    title: 'Sıcak Kahveler',
    icon: 'bi-cup',
    items: [
      { name: 'Espresso', desc: 'Yoğun lezzet, tek shot', img: 'img/espresso.png' },
      { name: 'Double Espresso', desc: 'İki shot espresso', img: 'img/doubleespresso.png' },
      { name: 'Cortado', desc: 'Yarım öz kahve + yarım süt', img: 'img/cortado.png' },
      { name: 'Espresso Flat White', desc: '1/3 kahve öz + 1/3 süt + 1/3 süt köpüğü', img: 'img/espressoflatwhite.png' },
      { name: 'Double Espresso Flat White', desc: 'İki shot flat white', img: 'img/doubleepressoflatwhite.png' },
      { name: 'Macchiato', desc: 'Espresso + köpük', img: 'img/macchiato.png' },
      { name: 'Double Shot Macchiato', desc: 'İki shot macchiato', img: 'img/macchiato.png' },
      { name: 'Red Eye', desc: 'Espresso + filtre kahve', img: 'img/redeye.png' },
      { name: 'Black Eye', desc: 'Double espresso + filtre kahve', img: 'img/blackeye.png' },
      { name: 'Filtre', desc: 'Taze demlenmiş filtre kahve', img: 'img/filtrekahve.png' },
      { name: 'Sütlü Filtre', desc: 'Filtre + sıcak süt', img: 'img/sutlufiltrekahve.png' },
      { name: 'Americano Hafif', desc: 'Espresso + bol sıcak su', img: 'img/americano.png' },
      { name: 'Americano Yoğun', desc: 'Double espresso + bol sıcak su', img: 'img/americano.png' },
      { name: 'Sütlü Americano', desc: 'Americano + sıcak süt', img: 'img/sutluamericano.png' },
      { name: 'Latte', desc: 'Bol sütlü yumuşak içim', img: 'img/vanilyalatte.png' },
      { name: 'Sahlep Latte', desc: 'Sahlep + sütlü kahve', img: 'img/sahlepmoc.png' },
      { name: 'Çikolat Latte', desc: 'Çikolata + sütlü kahve', img: 'img/cikoatalatte.png' },
      { name: 'Vanilya Latte', desc: 'Vanilya + sütlü kahve', img: 'img/vanilyalatte.png' },
      { name: 'Ceviz Latte', desc: 'Ceviz + sütlü kahve', img: 'img/coconatlatte.png' },
      { name: 'Karamel Latte', desc: 'Karamel + sütlü kahve', img: 'img/caramellatte.png' },
      { name: 'Coconut Latte', desc: 'Hindistan cevizi + sütlü kahve', img: 'img/coconatlatte.png' },
      { name: 'Mocha', desc: 'Çikolata + kahve + süt', img: 'img/mocha.png' },
      { name: 'White Mocha', desc: 'Beyaz çikolata + kahve + süt', img: 'img/whitemocha.png' },
      { name: 'Mix Mocha', desc: 'Karışık çikolata mocha', img: 'img/mocha.png' },
      { name: 'Cappuccino', desc: 'Bol köpüklü İtalyan klasiği', img: 'img/capp.png' },
      { name: 'Çikolat Cappuccino', desc: 'Çikolata + cappuccino', img: 'img/cikolatacapp.png' },
      { name: 'Sahlep Cappuccino', desc: 'Sahlep + cappuccino', img: 'img/sahlepcapp.png' },
      { name: 'Vanilya Cappuccino', desc: 'Vanilya + cappuccino', img: 'img/vanilyacapp.png' },
      { name: 'Türk Kahvesi', desc: 'Çifte kavrulmuş, lokum ile', img: 'img/turkkahvesi.png' },
      { name: 'Sütlü Türk Kahvesi', desc: 'Türk kahvesi + süt', img: 'img/sutluturkkahvesi.png' },
      { name: 'Dibek Kahvesi', desc: 'Yumuşak içim, taş değirmen', img: 'img/dibekkahvesi.png' },
      { name: 'Sütlü Dibek Kahvesi', desc: 'Dibek kahvesi + süt', img: 'img/sutludibekkahvesi.png' },
      { name: 'Atmosfer Coffee', desc: '2 küp şeker + espresso + hindistan cevizi + az köpüklü süt', img: 'img/capp.png' }
    ]
  },
  {
    id: 'soguk_kahveler',
    title: 'Soğuk Kahveler',
    icon: 'bi-snow',
    items: [
      { name: 'Shot Espresso', desc: 'Soğuk espresso shot', img: 'img/iceespresso.png' },
      { name: 'Shot Double Espresso', desc: 'İki shot soğuk espresso', img: 'img/icedoublespresso.png' },
      { name: 'Ice Cortado', desc: 'Yarım öz kahve + yarım süt + 5 buz', img: 'img/icecortado.png' },
      { name: 'Ice Espresso Flat White', desc: '1/3 kahve öz + 1/3 süt + 1/3 süt köpüğü', img: 'img/espressoflatwhite.png' },
      { name: 'Ice Double Espresso Flat White', desc: 'İki shot ice flat white', img: 'img/doubleepressoflatwhite.png' },
      { name: 'Ice Macchiato', desc: 'Espresso + köpük + buz', img: 'img/macchiato.png' },
      { name: 'Ice Double Shot Macchiato', desc: 'İki shot ice macchiato', img: 'img/macchiato.png' },
      { name: 'Ice Red', desc: 'Espresso + filtre + 5 buz', img: 'img/redeye.png' },
      { name: 'Ice Black', desc: 'Double espresso + filtre + 5 buz', img: 'img/blackeye.png' },
      { name: 'Soğuk Filtre', desc: 'Soğuk demlenmiş filtre kahve', img: 'img/filtrekahve.png' },
      { name: 'Soğuk Sütlü Filtre', desc: 'Soğuk filtre + soğuk süt', img: 'img/sutlufiltrekahve.png' },
      { name: 'Ice Americano Hafif', desc: 'Espresso + soğuk su + buz', img: 'img/americano.png' },
      { name: 'Ice Americano Yoğun', desc: 'Double espresso + soğuk su + buz', img: 'img/americano.png' },
      { name: 'Sparkling Americano', desc: 'Americano + soda', img: 'img/americano.png' },
      { name: 'Ice Sütlü Americano', desc: 'Americano + soğuk süt + buz', img: 'img/sutluamericano.png' },
      { name: 'Ice Latte', desc: 'Buzlu sütlü kahve', img: 'img/vanilyalatte.png' },
      { name: 'Ice Sahlep Latte', desc: 'Sahlep + ice latte', img: 'img/sahlepmoc.png' },
      { name: 'Ice Çikolat Latte', desc: 'Çikolata + ice latte', img: 'img/cikoatalatte.png' },
      { name: 'Ice Vanilya Latte', desc: 'Vanilya + ice latte', img: 'img/vanilyalatte.png' },
      { name: 'Ice Hazelnut Latte', desc: 'Fındık + ice latte', img: 'img/coconatlatte.png' },
      { name: 'Ice Caramel Latte', desc: 'Karamel + ice latte', img: 'img/caramellatte.png' },
      { name: 'Ice Coconut Latte', desc: 'Hindistan cevizi + ice latte', img: 'img/coconatlatte.png' },
      { name: 'Ice Ocha', desc: 'Soğuk Japon çayı', img: 'img/yesilcay.png' },
      { name: 'Ice White Mocha', desc: 'Beyaz çikolata + ice kahve', img: 'img/whitemocha.png' },
      { name: 'Ice Mix Mocha', desc: 'Karışık çikolata + ice kahve', img: 'img/mocha.png' },
      { name: 'Cococream Latte', desc: 'Hindistan cevizi kaymağı + ice latte', img: 'img/cococream.png' },
      { name: 'Ice Offer Coffee', desc: '2 küp şeker + espresso + hindistan cevizi + az köpüklü süt + buz', img: 'img/capp.png' }
    ]
  },
  {
    id: 'special_soguklar',
    title: 'Special Soğuklar',
    icon: 'bi-stars',
    items: [
      { name: 'Vanilya Milkshake', desc: 'Vanilya flavored milkshake', img: 'img/vanilyamilk.png' },
      { name: 'Çikolata Milkshake', desc: 'Çikolata flavored milkshake', img: 'img/cikolatalimilk.png' },
      { name: 'Çilek Milkshake', desc: 'Çilek flavored milkshake', img: 'img/cileklimilk.png' },
      { name: 'Muz Milkshake', desc: 'Muz flavored milkshake', img: 'img/muzilk.png' },
      { name: 'Mango Milkshake', desc: 'Taze mango milkshake', img: 'img/mangomilk.png' },
      { name: 'Sahlep Milkshake', desc: 'Sahlep flavored milkshake', img: 'img/vanilyamilk.png' },
      { name: 'Coconut Milkshake', desc: 'Hindistan cevizi milkshake', img: 'img/coconatmilk.png' },
      { name: 'Çilek Frozen', desc: 'Donmuş çilek', img: 'img/cilekfrozen.png' },
      { name: 'Lime Frozen', desc: 'Cool lime frozen', img: 'img/limefrozen.png' },
      { name: 'Lime Fizz Frozen', desc: 'Cool lime + sade soda frozen', img: 'img/limefrozen.png' },
      { name: 'Mango Frozen', desc: 'Donmuş mango', img: 'img/mangofrozen.png' },
      { name: 'The Jungle', desc: 'Nane + cool lime', img: 'img/thejungerfrozen.png' },
      { name: 'Sour Jungle', desc: 'Nane + cool lime + limon', img: 'img/thejungerfrozen.png' },
      { name: 'Jungle Fizz', desc: 'Nane + cool lime + sade soda', img: 'img/junglefizzfrozen.png' },
      { name: 'Jungle Sour Fizz', desc: 'Nane + cool lime + sade soda + limon', img: 'img/junglefizzfrozen.png' },
      { name: 'Mix Frozen', desc: 'Hibiscus + mango frozen', img: 'img/mixstylefrozen.png' },
      { name: 'Mikser Frozen', desc: 'Hibiscus + mango + cool lime frozen', img: 'img/cmixfrozen.png' }
    ]
  },
  {
    id: 'hizli_soguklar',
    title: 'Hızlı Soğuklar',
    icon: 'bi-cup',
    items: [
      { name: 'Süt', desc: 'Soğuk süt', img: 'img/sut.png' },
      { name: 'Sade Soda', desc: 'Sade gazlı su', img: 'img/soda.png' },
      { name: 'Limon Soda', desc: 'Limonlu gazlı su', img: 'img/limonlusoda.png' },
      { name: 'Cool Lime', desc: 'Soğuk lime içeceği', img: 'img/coollime.png' },
      { name: 'Sodalı Cool Lime', desc: 'Cool lime + soda', img: 'img/sodalicoollime.png' },
      { name: 'Mango Lime', desc: 'Mango + lime karışımı', img: 'img/mangolime.png' },
      { name: 'Sodalı Mango Lime', desc: 'Mango lime + soda', img: 'img/dimesmangolime.png' },
      { name: 'Mango', desc: 'Taze mango suyu', img: 'img/mangokoktey.png' },
      { name: 'Kokteyl', desc: 'Meyve kokteyli', img: 'img/koktey.png' },
      { name: 'Cococream', desc: 'Hindistan cevizi kaymağı', img: 'img/cococream.png' }
    ]
  },
  {
    id: 'pratik_soguklar',
    title: 'Special Soğuklar',
    icon: 'bi-cup',
    items: [
      { name: 'Cococream', desc: 'Hindistan cevizi kaymağı', img: 'img/cococream.png' },
      { name: 'Kokteyl', desc: 'Meyve kokteyli', img: 'img/koktey.png' },
      { name: 'Mango', desc: 'Taze mango suyu', img: 'img/mangokoktey.png' },
      { name: 'Sodali Mango Lime', desc: 'Mango lime + soda', img: 'img/dimesmangolime.png' },
      { name: 'Mango Lime', desc: 'Mango + lime karışımı', img: 'img/mangolime.png' },
      { name: 'Sodali Cool Lime', desc: 'Cool lime + soda', img: 'img/sodalicoollime.png' },
      { name: 'Cool Lime', desc: 'Soğuk lime içeceği', img: 'img/coollime.png' },
      { name: 'Churchill', desc: 'Churchill içeceği', img: 'img/churchill.png' },
      { name: 'Limonlu Soda', desc: 'Limonlu gazlı su', img: 'img/limonlusoda.png' },
      { name: 'Sade Soda', desc: 'Sade gazlı su', img: 'img/soda.png' },
      { name: 'Süt', desc: 'Soğuk süt', img: 'img/sut.png' }
    ]
  },
  {
    id: 'frozen',
    title: 'Frozen',
    icon: 'bi-snow',
    items: [
      { name: 'Mixstyle Frozen', desc: 'Mixstyle frozen içeceği', img: 'img/mixstylefrozen.png' },
      { name: 'Cmix Frozen', desc: 'Cmix frozen içeceği', img: 'img/cmixfrozen.png' },
      { name: 'Çilek Frozen', desc: 'Çilek frozen', img: 'img/cilekfrozen.png' },
      { name: 'The Jungle Frozen', desc: 'The jungle frozen', img: 'img/thejungerfrozen.png' },
      { name: 'Sour Jungle', desc: 'Sour jungle frozen', img: 'img/thejungerfrozen.png' },
      { name: 'Jungle Fizz Frozen', desc: 'Jungle fizz frozen', img: 'img/junglefizzfrozen.png' },
      { name: 'Lime Frozen', desc: 'Lime frozen', img: 'img/limefrozen.png' },
      { name: 'Mango Frozen', desc: 'Mango frozen', img: 'img/mangofrozen.png' },
      { name: 'Mango Lime Frozen', desc: 'Mango lime frozen', img: 'img/mangolime.png' },
      { name: 'Mango Fizz Frozen', desc: 'Mango fizz frozen', img: 'img/mangofrozen.png' }
    ]
  },
  {
    id: 'milkshake',
    title: 'Milkshake',
    icon: 'bi-cup',
    items: [
      { name: 'Coconut Milkshake', desc: 'Hindistan cevizi milkshake', img: 'img/coconatmilk.png' },
      { name: 'Sahlep Milkshake', desc: 'Sahlep milkshake', img: 'img/vanilyamilk.png' },
      { name: 'Mango Milkshake', desc: 'Mango milkshake', img: 'img/mangomilk.png' },
      { name: 'Muz Milkshake', desc: 'Muz milkshake', img: 'img/muzilk.png' },
      { name: 'Çilek Milkshake', desc: 'Çilek milkshake', img: 'img/cileklimilk.png' },
      { name: 'Çikolata Milkshake', desc: 'Çikolata milkshake', img: 'img/cikolatalimilk.png' },
      { name: 'Vanilya Milkshake', desc: 'Vanilya milkshake', img: 'img/vanilyamilk.png' }
    ]
  }
];

async function migrateMenuToFirestore() {
  try {
    console.log('📤 Menü verileri Firestore\'a aktarılıyor...');
    
    // Her kategoriyi ayrı bir dokuman olarak kaydet
    for (const category of menuData) {
      await db.collection('menu').doc(category.id).set(category);
      console.log(`✅ ${category.title} kaydedildi`);
    }
    
    console.log('✨ Tüm menü verileri başarıyla Firestore\'a aktarıldı!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

migrateMenuToFirestore();
