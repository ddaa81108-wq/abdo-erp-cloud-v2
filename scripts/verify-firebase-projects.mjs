import { readFileSync } from 'node:fs';

const HOSTING_PROJECT = 'abdocash121';
const DATA_PROJECT = 'abdonew-3dd25';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const aliases = readJson('.firebaserc').projects || {};
const appConfig = readJson('firebase-applet-config.json');
const scripts = readJson('package.json').scripts || {};

const checks = [
  [aliases.hosting === HOSTING_PROJECT, `اسم مشروع الاستضافة يجب أن يكون ${HOSTING_PROJECT}`],
  [aliases.data === DATA_PROJECT, `اسم مشروع البيانات يجب أن يكون ${DATA_PROJECT}`],
  [!aliases.default, 'يجب عدم وجود مشروع افتراضي حتى لا يعمل نشر عام على المشروع الخطأ'],
  [appConfig.projectId === DATA_PROJECT, `التطبيق يجب أن يتصل بمشروع البيانات ${DATA_PROJECT}`],
  [scripts['deploy:hosting']?.includes(`--project ${HOSTING_PROJECT}`), 'أمر نشر الاستضافة غير محدد المشروع'],
  [scripts['deploy:rules']?.includes(`--project ${DATA_PROJECT}`), 'أمر نشر القواعد غير محدد المشروع'],
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error('فشل التحقق من مشروعات Firebase:');
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`الاستضافة: ${HOSTING_PROJECT}`);
  console.log(`البيانات وتسجيل الدخول وقواعد Firestore: ${DATA_PROJECT}`);
  console.log('تم التحقق من الفصل الآمن بين مشروعي Firebase.');
}
