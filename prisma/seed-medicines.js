const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
// Load .env manually
const env = fs.readFileSync('.env', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const prisma = new PrismaClient();

const medicines = [
  // Pain & Inflammation
  { name: 'Ibuprofen', nameAr: 'إيبوبروفين', category: 'Pain Relief', dosageOptions: JSON.stringify(['200mg', '400mg', '600mg', '800mg']), instructions: 'Take with food. Do not exceed 3200mg/day.', instructionsAr: 'تناول مع الطعام. لا تتجاوز 3200 ملغ يومياً.' },
  { name: 'Paracetamol', nameAr: 'باراسيتامول', category: 'Pain Relief', dosageOptions: JSON.stringify(['500mg', '1000mg']), instructions: 'Do not exceed 4g/day. Avoid alcohol.', instructionsAr: 'لا تتجاوز 4 غرام يومياً. تجنب الكحول.' },
  { name: 'Diclofenac', nameAr: 'ديكلوفيناك', category: 'Pain Relief', dosageOptions: JSON.stringify(['25mg', '50mg', '75mg']), instructions: 'Take with meals. Monitor blood pressure.', instructionsAr: 'تناول مع الوجبات. راقب ضغط الدم.' },
  { name: 'Naproxen', nameAr: 'نابروكسين', category: 'Pain Relief', dosageOptions: JSON.stringify(['250mg', '500mg']), instructions: 'Take with food or milk.', instructionsAr: 'تناول مع الطعام أو الحليب.' },

  // Antibiotics
  { name: 'Amoxicillin', nameAr: 'أموكسيسيلين', category: 'Antibiotic', dosageOptions: JSON.stringify(['250mg', '500mg', '875mg']), instructions: 'Complete the full course. Take with or without food.', instructionsAr: 'أكمل الدورة الكاملة. يمكن تناوله مع الطعام أو بدونه.' },
  { name: 'Azithromycin', nameAr: 'أزيثروميسين', category: 'Antibiotic', dosageOptions: JSON.stringify(['250mg', '500mg']), instructions: 'Take on empty stomach. 5-day course.', instructionsAr: 'تناول على معدة فارغة. دورة 5 أيام.' },
  { name: 'Ciprofloxacin', nameAr: 'سيبروفلوكساسين', category: 'Antibiotic', dosageOptions: JSON.stringify(['250mg', '500mg', '750mg']), instructions: 'Drink plenty of water. Avoid dairy products 2hr before/after.', instructionsAr: 'اشرب الكثير من الماء. تجنب منتجات الألبان قبل/بعد ساعتين.' },

  // Dermatology / Topical
  { name: 'Hydrocortisone Cream 1%', nameAr: 'كريم هيدروكورتيزون 1%', category: 'Dermatology', dosageOptions: JSON.stringify(['Apply thin layer']), instructions: 'Apply thinly to affected area 1–2 times daily. Not for face.', instructionsAr: 'ضع طبقة رقيقة على المنطقة المصابة 1-2 مرات يومياً. لا تستخدم على الوجه.' },
  { name: 'Clotrimazole Cream 1%', nameAr: 'كريم كلوتريمازول 1%', category: 'Dermatology', dosageOptions: JSON.stringify(['Apply twice daily']), instructions: 'Apply twice daily for 2–4 weeks.', instructionsAr: 'ضع مرتين يومياً لمدة 2-4 أسابيع.' },
  { name: 'Tretinoin Cream 0.05%', nameAr: 'كريم تريتينوين 0.05%', category: 'Dermatology', dosageOptions: JSON.stringify(['Apply at night']), instructions: 'Apply at night only. Use sunscreen during the day.', instructionsAr: 'ضع في الليل فقط. استخدم واقي الشمس خلال النهار.' },
  { name: 'Benzoyl Peroxide 5%', nameAr: 'بيروكسيد البنزويل 5%', category: 'Dermatology', dosageOptions: JSON.stringify(['Apply once daily']), instructions: 'May bleach fabrics. Start with once daily.', instructionsAr: 'قد يبيّض الأقمشة. ابدأ بمرة واحدة يومياً.' },

  // Antihistamines / Allergy
  { name: 'Cetirizine', nameAr: 'سيتيريزين', category: 'Antihistamine', dosageOptions: JSON.stringify(['5mg', '10mg']), instructions: 'Take at bedtime if drowsy. Once daily.', instructionsAr: 'تناول عند النوم إذا شعرت بالنعاس. مرة واحدة يومياً.' },
  { name: 'Loratadine', nameAr: 'لوراتادين', category: 'Antihistamine', dosageOptions: JSON.stringify(['5mg', '10mg']), instructions: 'Non-drowsy. Once daily.', instructionsAr: 'لا يسبب النعاس. مرة واحدة يومياً.' },
  { name: 'Fexofenadine', nameAr: 'فيكسوفينادين', category: 'Antihistamine', dosageOptions: JSON.stringify(['120mg', '180mg']), instructions: 'Take with water, not fruit juice.', instructionsAr: 'تناول مع الماء، وليس عصير الفاكهة.' },

  // Vitamins & Supplements
  { name: 'Vitamin D3', nameAr: 'فيتامين د3', category: 'Supplement', dosageOptions: JSON.stringify(['1000 IU', '2000 IU', '5000 IU']), instructions: 'Take with a fatty meal for best absorption.', instructionsAr: 'تناول مع وجبة دهنية لأفضل امتصاص.' },
  { name: 'Vitamin C', nameAr: 'فيتامين سي', category: 'Supplement', dosageOptions: JSON.stringify(['500mg', '1000mg']), instructions: 'Can be taken at any time.', instructionsAr: 'يمكن تناوله في أي وقت.' },
  { name: 'Zinc Supplement', nameAr: 'مكمل الزنك', category: 'Supplement', dosageOptions: JSON.stringify(['10mg', '20mg', '50mg']), instructions: 'Take with food to reduce nausea.', instructionsAr: 'تناول مع الطعام لتقليل الغثيان.' },
  { name: 'Omega-3 Fish Oil', nameAr: 'أوميغا-3 زيت السمك', category: 'Supplement', dosageOptions: JSON.stringify(['1000mg', '2000mg']), instructions: 'Take with meals.', instructionsAr: 'تناول مع الوجبات.' },
  { name: 'Biotin', nameAr: 'بيوتين', category: 'Supplement', dosageOptions: JSON.stringify(['1000mcg', '5000mcg', '10000mcg']), instructions: 'Take once daily. Good for hair and nails.', instructionsAr: 'تناول مرة واحدة يومياً. جيد للشعر والأظافر.' },

  // Gastrointestinal
  { name: 'Omeprazole', nameAr: 'أوميبرازول', category: 'Gastrointestinal', dosageOptions: JSON.stringify(['10mg', '20mg', '40mg']), instructions: 'Take 30 min before meal.', instructionsAr: 'تناول 30 دقيقة قبل الوجبة.' },
  { name: 'Metoclopramide', nameAr: 'ميتوكلوبراميد', category: 'Gastrointestinal', dosageOptions: JSON.stringify(['5mg', '10mg']), instructions: 'Take 30 min before meals.', instructionsAr: 'تناول 30 دقيقة قبل الوجبات.' },
  { name: 'Loperamide', nameAr: 'لوبيراميد', category: 'Gastrointestinal', dosageOptions: JSON.stringify(['2mg']), instructions: 'Max 8mg/day. Drink fluids.', instructionsAr: 'الحد الأقصى 8 ملغ يومياً. اشرب السوائل.' },

  // Skincare Specific
  { name: 'Hyaluronic Acid Serum', nameAr: 'سيروم حمض الهيالورونيك', category: 'Skincare', dosageOptions: JSON.stringify(['Apply morning & night']), instructions: 'Apply to damp skin. Follow with moisturizer.', instructionsAr: 'ضع على البشرة الرطبة. اتبع بمرطب.' },
  { name: 'Niacinamide 10%', nameAr: 'نياسيناميد 10%', category: 'Skincare', dosageOptions: JSON.stringify(['Apply twice daily']), instructions: 'Can be mixed with most actives. Avoid with Vitamin C.', instructionsAr: 'يمكن خلطه مع معظم المواد الفعالة. تجنب مع فيتامين سي.' },
  { name: 'Salicylic Acid 2%', nameAr: 'حمض الساليسيليك 2%', category: 'Skincare', dosageOptions: JSON.stringify(['Apply once daily']), instructions: 'Use sunscreen. Can be drying — moisturize well.', instructionsAr: 'استخدم واقي الشمس. قد يجفف البشرة — رطّب جيداً.' },
  { name: 'Azelaic Acid 15%', nameAr: 'حمض الأزيليك 15%', category: 'Skincare', dosageOptions: JSON.stringify(['Apply twice daily']), instructions: 'Safe for sensitive skin. Apply before moisturizer.', instructionsAr: 'آمن للبشرة الحساسة. ضع قبل المرطب.' },
];

async function main() {
  console.log('Seeding medicines...');
  let created = 0;
  for (const med of medicines) {
    const exists = await prisma.medicine.findFirst({ where: { name: med.name } });
    if (!exists) {
      await prisma.medicine.create({ data: med });
      created++;
    }
  }
  console.log(`Done — ${created} new medicines added (${medicines.length - created} already existed).`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
