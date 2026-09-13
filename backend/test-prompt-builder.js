const assert = require('assert');
const { cloneDefaults, upgradePromptBuilder } = require('./prompt-builder-config');
const imageGeneration = require('../frontend/js/services/image-generation');

function selections(output, industry = 'education') {
  return {
    output: [output],
    industry: output === 'general-image' ? [] : [industry],
    palette: ['medical-blue'],
    style: ['minimal'],
    presentation: [output === 'mobile-app' ? 'phones' : output === 'general-image' ? 'clean-canvas' : 'browser'],
  };
}

const config = cloneDefaults();
const peopleFree = imageGeneration.compose(config, 'واجهة منصة تعليمية حديثة', selections('website'));
assert.match(peopleFree.prompt, /Professional desktop website UI\/UX screenshot/i);
assert.match(peopleFree.prompt, /Interface-only composition/i);
assert.doesNotMatch(peopleFree.prompt, /\b(?:woman|girl|person|portrait|teacher|student)\b/i);

assert.throws(
  () => imageGeneration.compose(config, 'صورة فتاة داخل عيادة حديثة', selections('general-image')),
  /Female image requests are not supported/,
);
assert.match(peopleFree.prompt, /Do not include women, girls/i);

const audienceIsNotVisual = imageGeneration.compose(config, 'واجهة منصة تعليمية للطلاب', selections('website'));
assert.match(audienceIsNotVisual.prompt, /Interface-only composition/i);

const restaurantDashboard = imageGeneration.compose(config, 'a restaurant management dashboard', selections('dashboard', 'restaurant'));
assert.match(restaurantDashboard.prompt, /Professional enterprise SaaS dashboard UI screenshot/i);
assert.match(restaurantDashboard.prompt, /menu management.*reservation schedules.*kitchen status/i);
assert.doesNotMatch(restaurantDashboard.prompt, /\b(?:woman|girl|person|portrait|staff|diner)\b/i);

const imageUrl = imageGeneration.buildUrl('test', { width: 1024, height: 1024 }, 1);
assert.match(imageUrl, /[?&]model=flux(?:&|$)/);

const legacy = cloneDefaults();
legacy.templates.negative = 'Do not replace the requested subject with a cityscape, abstract technology symbol, coin, or logo. Avoid unrelated objects, illegible text, duplicate screens, distorted UI, and watermarks.';
legacy.groups.find(group => group.id === 'industry').options.find(option => option.id === 'education').fragment = 'for education, using courses, teachers, students, progress, and learning resources';
const upgraded = upgradePromptBuilder(legacy);
assert.equal(upgraded.changed, true);
assert.match(upgraded.value.templates.negative, /unmistakable focus/i);
assert.doesNotMatch(upgraded.value.groups.find(group => group.id === 'industry').options.find(option => option.id === 'education').fragment, /teachers|students|portraits/i);

console.log('Prompt Builder tests passed.');
