/* FitCoach: free on-device coach and Ugandan food list. No AI service, no API key, nothing leaves the device. */
var FitCoach=(function(){
'use strict';
var F=[
['Matooke (steamed)','1 plate',330],['Posho (ugali)','1 plate',350],['Millet bread (kalo)','1 serving',280],
['Cassava, boiled','1 portion',230],['Sweet potato, boiled','1 medium',170],['Irish potato, boiled','1 medium',175],
['Rice, cooked','1 cup',205],['Chapati','1 piece',250],['Rolex (egg chapati roll)','1 roll',550],
['Katogo (matooke & beans)','1 plate',550],['Pilau','1 plate',500],['Chips','1 portion',450],
['Beans, stewed','1 cup',250,1],['Groundnut sauce','½ cup',250,1],['Beef stew','1 serving',250,1],
['Goat meat stew','1 serving',200,1],['Chicken stew','1 piece',250,1],['Fried chicken','1 piece',250,1],
['Fish stew','1 piece',200,1],['Fried tilapia','1 medium fish',300,1],['Luwombo (steamed stew)','1 serving',350,1],
['Roasted meat (muchomo)','100 g',250,1],['Egg, boiled','1 egg',78,1],['Groundnuts, roasted','1 handful',170,1],
['Dodo / greens','1 serving',80],['Cabbage, cooked','1 serving',70],
['Mandazi','1 piece',160],['Samosa','1 piece',150],['Bread with margarine','1 slice',110],['Sausage','1 piece',150],
['Roasted maize (cob)','1 cob',150],['Banana, ripe','1 medium',105],['Mango','1 medium',200],['Pineapple','2 slices',80],
['Avocado','½ fruit',160],['Watermelon','1 slice',45],['Passion fruit juice','1 glass',120],
['Tea with milk & sugar','1 cup',80],['Black tea with sugar','1 cup',50],['Milk','1 cup',120],
['Porridge (millet/maize)','1 cup',180],['Soda','300 ml',140]
];
var BY={};F.forEach(function(f){BY[f[0]]=f});
var SIZES=[['Small',0.7],['Regular',1],['Large',1.4]];
var POPULAR=['Matooke (steamed)','Posho (ugali)','Beans, stewed','Rolex (egg chapati roll)','Chapati','Rice, cooked','Mandazi','Banana, ripe'];
var COMBOS=[
['Posho (ugali)','Beans, stewed','Dodo / greens'],['Matooke (steamed)','Beans, stewed'],['Matooke (steamed)','Groundnut sauce'],
['Rice, cooked','Beans, stewed','Cabbage, cooked'],['Sweet potato, boiled','Egg, boiled'],['Posho (ugali)','Fish stew','Dodo / greens'],
['Millet bread (kalo)','Chicken stew','Dodo / greens'],['Cassava, boiled','Beans, stewed'],['Chapati','Beans, stewed'],
['Rice, cooked','Goat meat stew','Cabbage, cooked'],['Matooke (steamed)','Fish stew','Dodo / greens'],['Rolex (egg chapati roll)'],
['Banana, ripe','Groundnuts, roasted'],['Egg, boiled','Bread with margarine'],['Porridge (millet/maize)','Egg, boiled'],
['Tea with milk & sugar','Mandazi'],['Posho (ugali)','Beef stew','Cabbage, cooked']
];
var SNACKS=['Banana, ripe','Groundnuts, roasted','Egg, boiled','Milk','Roasted maize (cob)','Sweet potato, boiled','Mandazi'];

function iso(d){return d.toLocaleDateString('en-CA')}
function addDays(s,n){var d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)}
function dayKcal(S,d){return (S.foods[d]||[]).reduce(function(a,b){return a+b.kcal},0)}
function label(n){return n.split(/[,(]/)[0].trim()}
function comboKcal(c){return c.reduce(function(a,n){return a+(BY[n]?BY[n][2]:0)},0)}
function kcal(f,sizeIndex){return Math.max(5,Math.round(f[2]*SIZES[sizeIndex][1]/5)*5)}
function search(q){
  q=(q||'').trim().toLowerCase();
  if(!q)return POPULAR.map(function(n){return BY[n]});
  var words=q.split(/\s+/);
  return F.filter(function(f){var s=f[0].toLowerCase();return words.every(function(w){return s.indexOf(w)!==-1})}).slice(0,10);
}

function mealIdeas(S,snackOnly){
  var today=iso(new Date()),left=S.goal-dayKcal(S,today),h=new Date().getHours();
  if(left<120)return 'You are almost at your goal for today. If you are still hungry, choose something light like a banana, tea without sugar, or a glass of water.';
  var kind=(snackOnly||h>=21)?'snack':h<11?'breakfast':h<16?'lunch':'dinner';
  var target=Math.min(left,kind==='snack'?250:kind==='breakfast'?450:650);
  var pool=(kind==='snack'?SNACKS.map(function(n){return [n]}):COMBOS).map(function(c){return {c:c,k:comboKcal(c)}});
  var fit=pool.filter(function(x){return x.k<=target+60&&x.k>=target*0.45}).sort(function(a,b){return b.k-a.k});
  if(!fit.length)fit=pool.sort(function(a,b){return a.k-b.k}).slice(0,3);
  var r=new Date().getDate()%fit.length,picks=fit.slice(r).concat(fit.slice(0,r)).slice(0,3);
  return 'You have about '+left+' kcal left today. Ideas for '+(kind==='snack'?'a snack':kind)+' (around '+target+' kcal):\n'+
    picks.map(function(x){return '• '+x.c.map(label).join(' + ')+' (about '+x.k+' kcal)'}).join('\n')+
    '\nThese are rough estimates. Try to include a protein food and some greens when you can.';
}

function tips(S){
  var out=[],today=iso(new Date()),h=new Date().getHours(),i;
  var eaten=dayKcal(S,today),goal=S.goal,left=goal-eaten,n=(S.foods[today]||[]).length;
  if(goal<1200)out.push({k:'warn',t:'Your daily goal of '+goal+' kcal is quite low. Most adults need more, so please check with a doctor or dietitian before eating this little.'});
  if(!n)out.push({k:'info',t:'Nothing logged yet today. Log your first meal to see how today is going.'});
  else if(left<0)out.push({k:'info',t:'You are '+(-left)+' kcal over your goal today. One day over does not undo your progress. Just return to your usual target tomorrow.'});
  else if(h>=20&&eaten<goal*0.6)out.push({k:'warn',t:'You have eaten '+eaten+' of your '+goal+' kcal today. Eating far too little can leave you tired and hungry later, so have a proper meal if you are hungry.'});
  else out.push({k:'good',t:'You have '+left+' kcal left today.'});

  var days=[];for(i=0;i<7;i++)days.push(addDays(today,-i));
  var logged=days.filter(function(d){return dayKcal(S,d)>0});
  if(logged.length){
    var avg=Math.round(logged.reduce(function(a,d){return a+dayKcal(S,d)},0)/logged.length);
    out.push({k:logged.length>=5?'good':'info',t:'You logged '+logged.length+' of the last 7 days'+(logged.length<4?'. Logging most days makes these tips more accurate.':'. Nice consistency.')});
    out.push({k:avg>goal*1.1?'warn':'good',t:'On logged days you average '+avg+' kcal against a goal of '+goal+'.'+(avg>goal*1.1?' Smaller portions of staples like posho, rice or matooke are the easiest place to trim.':'')});
    var m={Breakfast:0,Lunch:0,Dinner:0,Snack:0},tot=0,bDays=0;
    logged.forEach(function(d){var hasB=false;(S.foods[d]||[]).forEach(function(x){m[x.meal]+=x.kcal;tot+=x.kcal;if(x.meal==='Breakfast')hasB=true});if(hasB)bDays++});
    if(logged.length>=3&&tot>0&&m.Dinner/tot>0.5)out.push({k:'info',t:'More than half of your calories come at dinner. Moving some of them to lunch can make evenings easier.'});
    if(logged.length>=4&&bDays<=1)out.push({k:'info',t:'You rarely log breakfast. If you get hungry mid-morning, something simple like tea with milk and a banana can help.'});
  }
  var streak=0,start=dayKcal(S,today)>0?0:1;
  for(i=start;i<60;i++){if(dayKcal(S,addDays(today,-i))>0)streak++;else break}
  if(streak>=3)out.push({k:'good',t:streak+'-day logging streak. Keep it going.'});

  var wc=S.water[today]||0;
  if(wc>=S.preferences.waterGoal)out.push({k:'good',t:'You reached your '+S.preferences.waterGoal+'-glass water goal today.'});
  else if(wc<Math.ceil(S.preferences.waterGoal/2)&&h>=15)out.push({k:'info',t:'Only '+wc+' glass'+(wc===1?'':'es')+' of water so far today. Try a glass with your next meal.'});

  var w=S.weights.slice().sort(function(a,b){return a.date<b.date?-1:1}).filter(function(x){return x.date>=addDays(today,-35)});
  if(w.length>=2){
    var a=w[0],b=w[w.length-1],span=(new Date(b.date)-new Date(a.date))/864e5;
    if(span>=6){
      var rate=(b.kg-a.kg)/(span/7),unit=S.preferences.weightUnit,scale=unit==='lb'?2.2046226218:1;
      var abs=(Math.abs(rate)*scale).toFixed(1),gw=S.goalWt;
      var losing=gw!==null&&gw<b.kg-0.2,gaining=gw!==null&&gw>b.kg+0.2;
      if(losing){
        if(rate<=-1)out.push({k:'warn',t:'You are losing about '+abs+' '+unit+' a week, which is faster than the usual '+(unit==='lb'?'0.6 to 2.2 lb':'0.25 to 1 kg')+'. Ease off if you can, and talk to a doctor or dietitian if you feel weak or dizzy.'});
        else if(rate<-0.15){
          var wk=(b.kg-gw)/(-rate),t='You are losing about '+abs+' '+unit+' a week, a steady pace.';
          if(wk<=104){var d=new Date();d.setDate(d.getDate()+Math.round(wk*7));t+=' If this continues you could reach '+(Math.round(gw*scale*10)/10)+' '+unit+' around '+d.toLocaleDateString('en-GB',{day:'numeric',month:'long'})+'.'}
          out.push({k:'good',t:t});
        }else if(rate<=0.15&&span>=14)out.push({k:'info',t:'Your weight has stayed about the same for '+Math.round(span/7)+' weeks. Daily weights bounce around, so check that your logging is complete, add a 20 to 30 minute walk, and give it two more weeks before changing your goal.'});
        else if(rate>0.15)out.push({k:'info',t:'Your weight is up about '+abs+' '+unit+' a week. Check portion sizes of staples and sugary drinks, and make sure everything you eat is logged.'});
      }else if(gaining){
        out.push(rate>0.05?{k:'good',t:'You are gaining about '+abs+' '+unit+' a week toward your goal.'}:{k:'info',t:'Your weight is not moving toward your goal yet. Add an extra portion of a staple plus a protein food each day.'});
      }else if(Math.abs(rate)>0.5)out.push({k:'info',t:'Your weight is changing by about '+abs+' '+unit+' a week. If you want to hold steady, adjust your portions a little.'});
      else out.push({k:'good',t:'Your weight is steady.'});
    }
  }else out.push({k:'info',t:'Log your weight about once a week on the Weight tab to see your trend and goal date.'});

  var rank={warn:0,good:1,info:2};
  return out.map(function(x,j){x.i=j;return x}).sort(function(a,b){return rank[a.k]-rank[b.k]||a.i-b.i}).slice(0,7);
}
function tipLine(S){var t=tips(S);return t.length?t[0].t:''}

function reply(text,S){
  var q=' '+String(text).toLowerCase().replace(/[^a-z0-9\s'’\/-]/g,' ')+' ';
  function has(re){return re.test(q)}
  if(has(/suicid|kill myself|end my life|self.?harm|hurt myself/))
    return 'I am really sorry you are feeling this way. You deserve support right now. Please reach out to someone you trust, or contact your local emergency number or a nearby health facility. You do not have to face this alone.';
  if(has(/eating disorder|anorex|bulimi|purg|binge|starv|laxative|diet pill/))
    return 'I cannot help with that safely. If food or weight feels out of control, or you are skipping meals or purging, please talk to a doctor or counsellor. Counting calories can make this harder, so it is okay to pause tracking and get support first.';
  if(has(/diabet|pregnan|breastfeed|kidney|blood pressure|hypertens|ulcer|medicat|\bsick\b|faint|dizz|chest pain|cancer|hiv/))
    return 'I cannot give medical advice for health conditions. Please talk to a doctor or dietitian about what is right for you. I can still help with general things like meal ideas from the food list.';
  if(has(/lose.*fast|fast.*(weight|lose)|crash|fasting|detox|skip(ping)? meals|1 week|one week|quick(ly)?/))
    return 'Fast weight loss usually backfires: you lose muscle and water, feel tired, and tend to regain it. A safe pace is about '+(S.preferences.weightUnit==='lb'?'0.6 to 2.2 lb':'0.25 to 1 kg')+' a week. Small steps work better: smaller portions of staples, more water, more greens and beans, and a daily walk.';
  if(has(/^\s*(hi|hello|hey|hallo|good (morning|afternoon|evening))\b/))
    return 'Hello! I can tell you how your week is going, suggest what to eat next, explain your calorie goal, or help you log food. What would you like?';
  if(has(/thank|thanks|cheers/))return 'You are welcome! I am here whenever you need me.';
  if(has(/how am i doing|progress|summary|insight|\btips?\b|this week|streak|review|how.*going/))
    return tips(S).slice(0,5).map(function(x){return '• '+x.t}).join('\n');
  if(has(/snack/))return mealIdeas(S,true);
  if(has(/what.*(eat|have|cook)|meal idea|ideas?|hungry|suggest|lunch|dinner|breakfast|next meal|recipe/))return mealIdeas(S,false);
  if(has(/balanc|plate|healthy meal|nutrition|healthy eating/))
    return 'A simple balanced plate: half greens or vegetables (dodo, cabbage, carrots), a quarter staple (matooke, posho, rice, sweet potato or cassava), and a quarter protein (beans, fish, eggs, chicken, meat or groundnuts). Add a fruit and drink water. Go easy on oil and sugary drinks.';
  if(has(/protein/))
    return 'Good protein foods in Uganda: beans, eggs, fish (omena, tilapia), chicken, goat or beef, groundnuts, milk and soya. Try to include one at every meal. It keeps you full for longer.';
  if(has(/water|hydrat|thirst/))
    return 'Aim for roughly 6 to 8 glasses of water a day. You may need more when it is hot or when you are active. A glass with each meal is an easy habit. Use the water counter on the Calories tab.';
  if(has(/(calorie|goal|target).*(work|calculat|how|why|set|mean|come)|how.*(goal|calorie)|why.*(goal|calorie)/))
    return 'Your goal starts from an estimate of the calories your body uses in a day (from age, sex, height and weight), multiplied by your activity level, minus about 500 kcal if you chose to lose weight. Your goal now is '+S.goal+' kcal. It is a rough starting point. If you are always hungry, or nothing changes after a few weeks, adjust it on the Weight tab under Goals.';
  if(has(/photo|scan|picture|camera|pic\b/))
    return 'Photo scanning needs an AI service, which may not be switched on in this app. You can always type a food name in the search box on the Calories tab. It has common Ugandan foods like matooke, posho, rolex and luwombo, with small, regular and large portions.';
  if(has(/(change|edit|update|set).*(goal|weight|target|calorie)|goal weight|profile/))
    return 'Go to the Weight tab and use the Goals card to change your daily calories and goal weight, then tap Save goals.';
  if(has(/\blog\b|logging|add (a )?(meal|food)|track|enter|record|how do i use/))
    return 'On the Calories tab: search a food (like matooke or rolex) and tap Small, Regular or Large, or use the quick-add buttons, or type your own food and calories and tap Add. Use the arrows to log another day. On the Weight tab you can save your weight and see your trend.';
  if(has(/plateau|stuck|not losing|no progress|stopped losing/))
    return 'Plateaus are normal. Check that you are logging everything, including oil, sugary tea and snacks. Add a 20 to 30 minute walk most days, sleep well, and give it two to three weeks before changing your goal.';
  if(has(/sugar|soda|sweet|juice|candy|cake/))
    return 'Sugary drinks add calories fast: a soda is about 140 kcal and tea with sugar adds up over the day. Try one less spoon of sugar, water or plain tea, and whole fruit instead of juice.';
  if(has(/exercise|workout|walk|gym|run|jog|fitness/))
    return 'Start with walking 20 to 30 minutes most days, then add more as it feels easy. Strength work like squats and push-ups twice a week helps too. If you have a health condition, check with a doctor first.';
  return 'I can help with: how your week is going, what to eat next, a balanced plate, protein foods, water, how your calorie goal works, logging food, or breaking through a plateau. Try one of the buttons below.';
}

return {all:F,sizes:SIZES,search:search,kcal:kcal,tips:tips,tipLine:tipLine,reply:reply};
})();
(function(){
var KEY='daily-tracker-v1';
function defaultPreferences(){return {theme:'system',weightUnit:'kg',waterGoal:8}}
function defaultState(){return {goal:2000,goalWt:null,foods:{},weights:[],water:{},preferences:defaultPreferences(),setupComplete:false}}
function normalizeState(value){
  var state=defaultState();
  if(!value||typeof value!=='object'||Array.isArray(value))return state;
  if(Number.isInteger(value.goal)&&value.goal>=800&&value.goal<=6000)state.goal=value.goal;
  if(value.goalWt===null||(typeof value.goalWt==='number'&&Number.isFinite(value.goalWt)&&value.goalWt>=20&&value.goalWt<=400))state.goalWt=value.goalWt;
  if(value.foods&&typeof value.foods==='object'&&!Array.isArray(value.foods)){
    Object.keys(value.foods).forEach(function(date){
      var items=value.foods[date];
      if(!Array.isArray(items))return;
      state.foods[date]=items.filter(function(item){
        return item&&typeof item.name==='string'&&item.name.length<=60&&Number.isInteger(item.kcal)&&item.kcal>=1&&item.kcal<=5000&&['Breakfast','Lunch','Dinner','Snack'].indexOf(item.meal)!==-1;
      }).map(function(item){return {id:item.id||Date.now()+Math.random(),name:item.name,kcal:item.kcal,meal:item.meal}});
    });
  }
  if(Array.isArray(value.weights)){
    state.weights=value.weights.filter(function(item){
      return item&&typeof item.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&typeof item.kg==='number'&&Number.isFinite(item.kg)&&item.kg>=20&&item.kg<=400;
    }).map(function(item){return {date:item.date,kg:item.kg}});
  }
  if(value.water&&typeof value.water==='object'&&!Array.isArray(value.water)){
    Object.keys(value.water).forEach(function(date){
      var count=value.water[date];
      if(Number.isInteger(count)&&count>=0&&count<=40)state.water[date]=count;
    });
  }
  if(value.preferences&&typeof value.preferences==='object'&&!Array.isArray(value.preferences)){
    if(['system','light','dark'].indexOf(value.preferences.theme)!==-1)state.preferences.theme=value.preferences.theme;
    if(['kg','lb'].indexOf(value.preferences.weightUnit)!==-1)state.preferences.weightUnit=value.preferences.weightUnit;
    if(Number.isInteger(value.preferences.waterGoal)&&value.preferences.waterGoal>=1&&value.preferences.waterGoal<=40)state.preferences.waterGoal=value.preferences.waterGoal;
  }
  state.setupComplete=value.setupComplete===true;
  return state;
}
var S=defaultState();
function weightUnit(){return S.preferences.weightUnit}
function toDisplayWeight(kg){return Math.round((weightUnit()==='lb'?kg*2.2046226218:kg)*10)/10}
function fromDisplayWeight(value){return weightUnit()==='lb'?value/2.2046226218:value}
function formatWeight(kg){return toDisplayWeight(kg).toFixed(1)+' '+weightUnit()}
function formatWeightChange(kg){
  var value=toDisplayWeight(kg);
  return (value>0?'+':'')+value.toFixed(1)+' '+weightUnit();
}
function applyTheme(){
  if(S.preferences.theme==='system')document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme',S.preferences.theme);
}
function renderSettings(){
  $('setting-theme').value=S.preferences.theme;
  $('setting-units').value=S.preferences.weightUnit;
  $('setting-water-goal').value=S.preferences.waterGoal;
  applyTheme();
  var isLb=weightUnit()==='lb';
  $('weight-unit-label').textContent='Weight ('+weightUnit()+')';
  $('goal-weight-unit-label').textContent='Goal weight ('+weightUnit()+')';
  $('chart-unit').textContent=weightUnit();
  $('wkg').min=isLb?'44.1':'20';
  $('wkg').max=isLb?'881.8':'400';
  $('wkg').placeholder=isLb?'e.g. 150.8':'e.g. 68.4';
  $('swt').min=isLb?'44.1':'20';
  $('swt').max=isLb?'881.8':'400';
}
var supabaseClient=null;
var currentUser=null;
var loadedUserId=null;
var loadingUserId=null;
var accountGeneration=0;
var pendingSave=Promise.resolve(true);
var importLegacyOnFirstLogin=false;
function $(id){return document.getElementById(id)}
function message(id,text,isError){
  var el=$(id);
  el.textContent=text;
  if(text)el.setAttribute('data-error',String(isError));
  else el.removeAttribute('data-error');
}
function fieldError(input,text){
  input.setAttribute('aria-invalid',String(Boolean(text)));
  if(text)input.setAttribute('title',text);
  else input.removeAttribute('title');
}
async function save(){
  if(!supabaseClient||!currentUser)return false;
  var userId=currentUser.id;
  var snapshot=JSON.parse(JSON.stringify(S));
  function writeSnapshot(){
    if(!currentUser||currentUser.id!==userId)return true;
    return supabaseClient.from('tracker_data').upsert({
      user_id:userId,
      data:snapshot,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'}).then(function(result){
      if(result.error)throw result.error;
      if(currentUser&&currentUser.id===userId)message('sync-status','Saved to your account.',false);
      return true;
    });
  }
  message('sync-status','Saving to your account…',false);
  pendingSave=pendingSave.catch(function(){return false}).then(writeSnapshot).catch(function(error){
    console.error('Unable to save tracker data to Supabase:',error);
    if(currentUser&&currentUser.id===userId)message('sync-status','Could not save to your account. Check your connection and Supabase setup, then try again.',true);
    return false;
  });
  return pendingSave;
}
function iso(d){return d.toLocaleDateString('en-CA')}
var day=iso(new Date());
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nice(s){var d=new Date(s+'T12:00:00');return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
var QUICK=[['Rolex',550],['Chapati',250],['Posho (1 plate)',350],['Matooke (1 plate)',300],['Beans (1 cup)',230],['Rice (1 cup)',205],['Mandazi',150],['Banana',105],['Tea with sugar',50],['Milk (1 cup)',120], ['Bread(2 slices)',160], ['Egg (1 large)',70]];
$('chips').innerHTML=QUICK.map(function(q,i){return '<button class="chip" data-i="'+i+'">'+q[0]+' · '+q[1]+'</button>'}).join('');
var mealByHour=function(){var h=new Date().getHours();return h<11?'Breakfast':h<16?'Lunch':h<21?'Dinner':'Snack'};

var selectedGoal='lose';
var caloriesEdited=false;
function estimateCalories(){
  var age=Number($('oage').value),height=Number($('oht').value),weight=Number($('owt').value);
  if(!age||!height||!weight)return null;
  var bmr=10*weight+6.25*height-5*age+($('osex').value==='m'?5:-161);
  var target=bmr*Number($('oactivity').value)-(selectedGoal==='lose'?500:0);
  return Math.max(1000,Math.min(6000,Math.round(target/50)*50));
}
function updateSuggestion(){
  var estimate=estimateCalories();
  if(estimate===null){$('osug').textContent='';return}
  $('osug').textContent='Suggested starting target: '+estimate+' kcal/day. This is a rough estimate; adjust it to suit your needs.';
  if(!caloriesEdited)$('okcal').value=estimate;
}
['oage','osex','oht','owt','oactivity'].forEach(function(id){
  $(id).addEventListener('input',updateSuggestion);
  $(id).addEventListener('change',updateSuggestion);
});
$('okcal').addEventListener('input',function(){caloriesEdited=true});
$('onboard-form').addEventListener('invalid',function(e){
  var input=e.target;
  var reason=input.validity.valueMissing?'Please fill in this field.':
    input.validity.rangeUnderflow?'Enter a value of at least '+input.min+'.':
    input.validity.rangeOverflow?'Enter a value no greater than '+input.max+'.':
    input.validity.stepMismatch?'Enter a value in the allowed increments.':
    'Enter a valid number.';
  $('oerr').textContent=reason;
},true);
Array.prototype.forEach.call($('onboard-form').querySelectorAll('input,select'),function(input){
  input.setAttribute('aria-describedby','oerr');
  input.addEventListener('input',function(){$('oerr').textContent=''});
  input.addEventListener('change',function(){$('oerr').textContent=''});
});
$('seg').onclick=function(e){
  var b=e.target.closest('button[data-g]');
  if(!b)return;
  selectedGoal=b.dataset.g;
  Array.prototype.forEach.call($('seg').querySelectorAll('button'),function(button){
    button.setAttribute('aria-pressed',button===b);
  });
  updateSuggestion();
};
$('onboard-form').onsubmit=async function(e){
  e.preventDefault();
  $('oerr').textContent='';
  var estimate=estimateCalories();
  var goalInput=$('okcal').value;
  var calories=goalInput===''?estimate:Number(goalInput);
  var goalWeight=$('ogw').value===''?null:Number($('ogw').value);
  if(estimate===null||!isFinite(calories)||calories<1000||calories>6000||
     (goalWeight!==null&&(!isFinite(goalWeight)||goalWeight<20||goalWeight>400))){
    $('oerr').textContent='Check your details and enter values within the stated ranges.';
    return;
  }
  S.weights=Array.isArray(S.weights)?S.weights:[];
  var today=iso(new Date());
  var previousSetup={goal:S.goal,goalWt:S.goalWt,weights:S.weights,setupComplete:S.setupComplete};
  S.goal=calories;
  S.goalWt=goalWeight;
  var hadToday=S.weights.some(function(item){return item.date===today});
  if(!hadToday)S.weights=S.weights.concat([{date:today,kg:Math.round(Number($('owt').value)*10)/10}]);
  S.setupComplete=true;
  if(!await save()){
    S.goal=previousSetup.goal;
    S.goalWt=previousSetup.goalWt;
    S.weights=previousSetup.weights;
    S.setupComplete=previousSetup.setupComplete;
    $('oerr').textContent='Could not save your setup to your account. Check your connection and try again.';
    return;
  }
  $('onb').hidden=true;
  $('tabs').hidden=false;
  $('p-food').hidden=false;
  $('p-wt').hidden=true;
  $('wdate').value=today;
  renderFood();
  renderWeight();
};

function tab(w){
 ['food','wt','coach','settings'].forEach(function(name){
    var selected=name===w;
    $('p-'+name).hidden=!selected;
    $('t-'+name).setAttribute('aria-selected',selected);
  });
  if(w==='coach')renderInsights();
  if(w==='settings'){renderSettings();refreshPlan(true)}
}
$('t-food').onclick=function(){tab('food')};
$('t-wt').onclick=function(){tab('wt')};
$('t-coach').onclick=function(){tab('coach')};
$('t-settings').onclick=function(){tab('settings')};
$('settings-form').onsubmit=async function(event){
  event.preventDefault();
  var theme=$('setting-theme').value,unit=$('setting-units').value;
  var waterGoal=Number($('setting-water-goal').value);
  if(['system','light','dark'].indexOf(theme)===-1||['kg','lb'].indexOf(unit)===-1||
     !Number.isInteger(waterGoal)||waterGoal<1||waterGoal>WATER_MAX){
    message('settings-message','Choose a valid theme, weight unit, and water goal from 1 to 40 glasses.',true);
    return;
  }
  var previous=S.preferences;
  var pendingWeight=$('wkg').value;
  S.preferences={theme:theme,weightUnit:unit,waterGoal:waterGoal};
  if(!await save()){
    S.preferences=previous;
    renderSettings();
    message('settings-message','Could not save your preferences. Check your connection and try again.',true);
    return;
  }
  if(unit!==previous.weightUnit&&pendingWeight!==''){
    var pendingValue=Number(pendingWeight);
    if(isFinite(pendingValue)){
      var pendingKg=previous.weightUnit==='lb'?pendingValue/2.2046226218:pendingValue;
      $('wkg').value=(unit==='lb'?pendingKg*2.2046226218:pendingKg).toFixed(1);
    }
  }
  renderSettings();
  renderWater();
  renderWeight();
  message('settings-message','Preferences saved to your account.',false);
};

function shift(n){var d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);day=iso(d);renderFood()}
$('prev').onclick=function(){shift(-1)};$('next').onclick=function(){shift(1)};

function renderFood(){
  var items=S.foods[day]||[];
  var total=items.reduce(function(a,b){return a+b.kcal},0);
  var left=S.goal-total;
  $('dlabel').textContent=day===iso(new Date())?'Today, '+nice(day):nice(day);
  $('eaten').textContent=total;$('goal').textContent=S.goal;
  $('remain').textContent=Math.abs(left);
  $('remainlbl').textContent=left>=0?'kcal left':'kcal over';
  var r=$('ring');r.style.stroke=left<0?'var(--warn)':'var(--pri)';
  r.setAttribute('stroke-dashoffset',439.8*(1-Math.min(total/S.goal,1)));
  $('flist').innerHTML=items.length?items.map(function(it){return '<li><div class="nm">'+esc(it.name)+'<small>'+esc(it.meal)+'</small></div><b>'+it.kcal+'</b><button class="x" data-id="'+it.id+'" aria-label="Delete '+esc(it.name)+'">✕</button></li>'}).join(''):'<li class="empty">Nothing logged yet. Add your first meal above.</li>';
  renderWater();
    refreshPlan(false);
}
var WATER_MAX=40;
function waterCount(date){
  var count=S.water[date];
  return Number.isInteger(count)&&count>=0&&count<=WATER_MAX?count:0;
}
function glassLabel(count){return count+' '+(count===1?'glass':'glasses')}
function renderWater(){
  var count=waterCount(day);
  $('wcount').textContent=count;
  $('wgoal').textContent='of '+S.preferences.waterGoal+' glasses · '+(count*250)+' ml';
  $('wminus').disabled=count===0;
  $('wplus').disabled=count>=WATER_MAX||day>iso(new Date());
  $('cups').textContent='';
  $('cups').setAttribute('aria-label',count+' glasses logged for '+nice(day));
  for(var i=0;i<S.preferences.waterGoal;i++){
    var cup=document.createElement('span');
    cup.className='cup'+(i<count?' filled':'');
    cup.setAttribute('aria-hidden','true');
    $('cups').appendChild(cup);
  }
  var bars=$('week');
  bars.textContent='';
  bars.setAttribute('aria-label','Water logged over the seven days ending '+nice(day));
  var dates=[];
  for(var offset=6;offset>=0;offset--){
    var date=new Date(day+'T12:00:00');
    date.setDate(date.getDate()-offset);
    dates.push(iso(date));
  }
  var counts=dates.map(waterCount);
  var maxCount=Math.max.apply(null,[S.preferences.waterGoal].concat(counts));
  dates.forEach(function(date,index){
    var entry=document.createElement('div');
    entry.className='week-day';
    var bar=document.createElement('div');
    bar.className='week-bar';
    bar.style.height=(counts[index]/maxCount*100)+'%';
    bar.setAttribute('aria-label',glassLabel(counts[index]));
    var label=document.createElement('span');
    label.className='week-label';
    label.textContent=new Date(date+'T12:00:00').toLocaleDateString('en',{weekday:'short'});
    entry.appendChild(bar);
    entry.appendChild(label);
    bars.appendChild(entry);
  });
  $('wk').textContent='';
  var low=document.createElement('span');
  low.textContent='0 glasses';
  var high=document.createElement('span');
  high.textContent=glassLabel(maxCount);
  $('wk').appendChild(low);
  $('wk').appendChild(high);
  var total=counts.reduce(function(sum,value){return sum+value},0);
  $('wksum').textContent='Last 7 days: '+glassLabel(total)+' ('+(total*250)+' ml).';
}
async function changeWater(delta){
  if(day>iso(new Date())){
    message('water-message','Water can only be logged for today or a past date.',true);
    return;
  }
  var current=waterCount(day);
  var next=current+delta;
  if(next<0||next>WATER_MAX)return;
  var previous=S.water;
  var updated=Object.assign({},previous);
  if(next===0)delete updated[day];
  else updated[day]=next;
  S.water=updated;
  if(!await save()){
    S.water=previous;
    message('water-message','Could not save water intake to your account. Check your connection and try again.',true);
    return;
  }
  message('water-message','',false);
  renderWater();
}
$('wplus').onclick=async function(){
  if(waterCount(day)>=WATER_MAX){
    message('water-message','Daily water entries are limited to 40 glasses.',true);
    return;
  }
  await changeWater(1);
};
 $('wminus').onclick=async function(){await changeWater(-1)};
async function addFood(name,kcal,meal){
  if(!name||name.length>60||!Number.isInteger(kcal)||kcal<1||kcal>5000||
     ['Breakfast','Lunch','Dinner','Snack'].indexOf(meal)===-1)return false;
  var items=S.foods[day]||[];
  var updated=items.concat([{id:Date.now()+Math.random(),name:name,kcal:kcal,meal:meal}]);
  S.foods[day]=updated;
  if(!await save()){
    if(items.length)S.foods[day]=items;
    else delete S.foods[day];
    return false;
  }
  renderFood();
  return true;
}
$('addfood').onclick=async function(){
  var nameInput=$('fname'),kcalInput=$('fkcal');
  var name=nameInput.value.trim(),rawKcal=kcalInput.value,kcal=Number(rawKcal);
  message('food-message','',false);
  fieldError(nameInput,'');fieldError(kcalInput,'');
  if(!name){
    message('food-message','Enter a food name.',true);fieldError(nameInput,'Enter a food name.');nameInput.focus();return;
  }
  if(name.length>60){
    message('food-message','Food names must be 60 characters or fewer.',true);fieldError(nameInput,'Food names must be 60 characters or fewer.');nameInput.focus();return;
  }
  if(rawKcal===''||!Number.isInteger(kcal)||kcal<1||kcal>5000){
    var kcalError='Enter whole calories from 1 to 5000.';
    message('food-message',kcalError,true);fieldError(kcalInput,kcalError);kcalInput.focus();return;
  }
  if(!await addFood(name,kcal,$('fmeal').value)){
    message('food-message','Could not save this food to your account. Check your connection and try again.',true);
    return;
  }
  message('food-message','Food added to today’s log.',false);
  $('fname').value='';$('fkcal').value='';$('fname').focus();
};
[['fname','food-message'],['fkcal','food-message']].forEach(function(pair){
  $(pair[0]).addEventListener('input',function(){
    fieldError($(pair[0]),'');
    message(pair[1],'',false);
  });
});
$('chips').onclick=async function(e){
  var b=e.target.closest('.chip');if(!b)return;
  var q=QUICK[b.dataset.i];
  if(await addFood(q[0],q[1],mealByHour()))message('food-message',q[0]+' added to today’s log.',false);
  else message('food-message','Could not save this food to your account. Check your connection and try again.',true);
};
var fsearch=$('fsearch'),fresults=$('fresults');
function renderFoodResults(){
  var list=FitCoach.search(fsearch.value);
  fresults.innerHTML=list.length?list.map(function(f){
    var idx=FitCoach.all.indexOf(f);
    return '<div class="fres"><div class="fres-name"><b>'+esc(f[0])+'</b><small>'+esc(f[1])+'</small></div><div class="sizes">'+FitCoach.sizes.map(function(sz,si){
      return '<button type="button" class="sz" data-f="'+idx+'" data-s="'+si+'" aria-label="Add '+esc(sz[0].toLowerCase()+' '+f[0])+', '+FitCoach.kcal(f,si)+' kcal"><span>'+sz[0]+'</span>'+FitCoach.kcal(f,si)+'</button>';
    }).join('')+'</div></div>';
  }).join(''):'<p class="note">No match. Type the food and its calories below instead.</p>';
}
fsearch.addEventListener('input',renderFoodResults);
fresults.onclick=async function(e){
  var b=e.target.closest('.sz');if(!b)return;
  var f=FitCoach.all[Number(b.dataset.f)],si=Number(b.dataset.s),size=FitCoach.sizes[si];
  var name=(f[0]+(si===1?'':' ('+size[0].toLowerCase()+')')).slice(0,60);
  if(await addFood(name,FitCoach.kcal(f,si),mealByHour()))message('food-message',name+' added to today’s log.',false);
  else message('food-message','Could not save this food to your account. Check your connection and try again.',true);
};
renderFoodResults();
function renderTip(){
  var el=$('tip'),t='';
  try{t=FitCoach.tipLine(S)}catch(err){}
  el.textContent=t;el.hidden=!t;
}
var planAt=0;
async function refreshPlan(force){
  var el=$('planinfo');
  if(!el||!currentUser)return;
  if(!force&&Date.now()-planAt<60000)return;
  planAt=Date.now();
  try{
    var headers=await getAuthHeaders();
    var res=await fetch('/api/plan',{headers:headers,cache:'no-store'});
    if(!res.ok)throw new Error('plan');
    var p=await res.json();
    el.textContent=p.configured?((p.premium?'Premium: ':'Free plan: ')+p.left+' of '+p.limit+' photo scans left today.'):'';
    var purchaseButton=$('subscribe');
    if(p.premium){
      $('subscription-status').textContent='Premium is active'+(p.premiumUntil?' until '+new Date(p.premiumUntil).toLocaleDateString():'')+
        (p.subscriptionStatus==='cancelled'?'. It will not renew.':'.');
      purchaseButton.textContent='Premium active';
      purchaseButton.disabled=true;
    }else{
      $('subscription-status').textContent=p.purchaseConfigured?'No active Premium subscription.':'Purchases are not configured yet. Please contact the app administrator.';
      purchaseButton.textContent='Subscribe with Flutterwave';
      purchaseButton.disabled=!p.purchaseConfigured;
    }
  }catch(err){
    el.textContent='Could not load scan-plan details. Try again shortly.';
    $('subscription-status').textContent='Could not load subscription details. Try again shortly.';
  }
}
async function verifyPurchaseReturn(){
  var url=new URL(window.location.href);
  var status=url.searchParams.get('status');
  var txRef=url.searchParams.get('tx_ref');
  var transactionId=url.searchParams.get('transaction_id');
  if(!status&&!txRef&&!transactionId)return;
  url.searchParams.delete('status');
  url.searchParams.delete('tx_ref');
  url.searchParams.delete('transaction_id');
  window.history.replaceState({},'',url.pathname+url.search+url.hash);
  if(status!=='successful'||!txRef||!transactionId){
    message('purchase-message','Payment was not completed. You can try subscribing again.',true);
    return;
  }
  var button=$('subscribe');
  button.disabled=true;
  message('purchase-message','Verifying your payment securely…',false);
  try{
    var headers=await getAuthHeaders();
    headers['Content-Type']='application/json';
    var response=await fetch('/api/purchase/verify',{
      method:'POST',
      headers:headers,
      body:JSON.stringify({txRef:txRef,transactionId:transactionId})
    });
    var result=await response.json().catch(function(){throw new Error('The payment service returned an invalid response.')});
    if(!response.ok)throw new Error(result.error||'Could not verify your payment.');
    message('purchase-message','Payment verified. Premium photo scanning is active.',false);
    planAt=0;
    await refreshPlan(true);
  }catch(error){
    message('purchase-message',error.message||'Could not verify your payment. Contact support before trying again.',true);
  }finally{
    button.disabled=false;
    await refreshPlan(true);
  }
}
$('subscribe').onclick=async function(){
  var button=$('subscribe');
  button.disabled=true;
  message('purchase-message','Opening secure Flutterwave checkout…',false);
  try{
    var headers=await getAuthHeaders();
    headers['Content-Type']='application/json';
    var response=await fetch('/api/purchase/checkout',{method:'POST',headers:headers,body:'{}'});
    var result=await response.json().catch(function(){throw new Error('The payment service returned an invalid response.')});
    if(!response.ok)throw new Error(result.error||'Could not start checkout.');
    window.location.assign(result.checkoutUrl);
  }catch(error){
    message('purchase-message',error.message||'Could not start checkout. Please try again.',true);
    button.disabled=false;
  }
};
function renderInsights(){
  var box=$('insights');if(!box)return;
  var list=[];
  try{list=FitCoach.tips(S)}catch(err){}
  box.innerHTML=list.map(function(x){return '<p class="insight" data-k="'+x.k+'">'+esc(x.t)+'</p>'}).join('');
}
$('flist').onclick=async function(e){
  var b=e.target.closest('.x');if(!b)return;
  var previous=S.foods[day]||[];
  S.foods[day]=previous.filter(function(x){return String(x.id)!==b.dataset.id});
  if(!await save()){
    S.foods[day]=previous;
    message('food-message','Could not delete this food from your account. Check your connection and try again.',true);
  }
  renderFood();
};

function sorted(){return S.weights.slice().sort(function(a,b){return a.date<b.date?-1:1})}
function renderWeight(){
  renderSettings();
  var w=sorted();
  var last=w[w.length-1],first=w[0];
  $('wlatest').textContent=last?formatWeight(last.kg):'–';
  $('wchange').textContent=(last&&first&&w.length>1)?formatWeightChange(last.kg-first.kg):'–';
  $('wtogoal').textContent=(last&&S.goalWt)?formatWeight(Math.abs(last.kg-S.goalWt)):'–';
  $('sgoal').value=S.goal;$('swt').value=S.goalWt===null?'':toDisplayWeight(S.goalWt);
  var c=$('chart');
  if(w.length<2){c.innerHTML='<div class="empty">Log at least two weights to see your trend.</div>'}
  else{
    var W=320,H=170,pl=34,pr=10,pt=12,pb=24;
    var vals=w.map(function(x){return toDisplayWeight(x.kg)});if(S.goalWt)vals.push(toDisplayWeight(S.goalWt));
    var lo=Math.floor(Math.min.apply(null,vals)-1),hi=Math.ceil(Math.max.apply(null,vals)+1);
    if(hi===lo){lo-=1;hi+=1;}
    var t0=new Date(w[0].date).getTime(),t1=new Date(w[w.length-1].date).getTime();
    function X(d){return pl+(t1===t0?0:(new Date(d).getTime()-t0)/(t1-t0))*(W-pl-pr)}
    function Y(v){return pt+(hi-v)/(hi-lo)*(H-pt-pb)}
    var pts=w.map(function(x){return X(x.date).toFixed(1)+','+Y(toDisplayWeight(x.kg)).toFixed(1)}).join(' ');
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Weight over time in '+weightUnit()+'">';
    [lo,(lo+hi)/2,hi].forEach(function(v){s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--line)"/><text x="'+(pl-4)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="10" fill="var(--mute)">'+(Math.round(v*10)/10)+'</text>'});
    if(S.goalWt)s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(toDisplayWeight(S.goalWt))+'" y2="'+Y(toDisplayWeight(S.goalWt))+'" stroke="var(--warn)" stroke-dasharray="4 4"/>';
    s+='<polyline points="'+pts+'" fill="none" stroke="var(--pri)" stroke-width="2.5" stroke-linejoin="round"/>';
    w.forEach(function(x){s+='<circle cx="'+X(x.date)+'" cy="'+Y(toDisplayWeight(x.kg))+'" r="3.5" fill="var(--pri)"/>'});
    s+='<text x="'+pl+'" y="'+(H-6)+'" font-size="10" fill="var(--mute)">'+nice(w[0].date)+'</text><text x="'+(W-pr)+'" y="'+(H-6)+'" text-anchor="end" font-size="10" fill="var(--mute)">'+nice(w[w.length-1].date)+'</text></svg>';
    c.innerHTML=s;
  }
  $('wlist').innerHTML=w.length?w.slice().reverse().map(function(x){return '<li><div class="nm">'+nice(x.date)+'</div><b>'+formatWeight(x.kg)+'</b><button class="x" data-d="'+x.date+'" aria-label="Delete entry">✕</button></li>'}).join(''):'<li class="empty">No weights yet. Save your first one above.</li>';
}
$('wdate').value=iso(new Date());
$('wdate').max=iso(new Date());
['wkg','wdate'].forEach(function(id){
  $(id).addEventListener('input',function(){
    fieldError($(id),'');
    message('weight-message','',false);
  });
  $(id).addEventListener('change',function(){
    fieldError($(id),'');
    message('weight-message','',false);
  });
});
$('addwt').onclick=async function(){
  var weightInput=$('wkg'),dateInput=$('wdate');
  var rawWeight=weightInput.value,displayWeight=Number(rawWeight),kg=fromDisplayWeight(displayWeight),d=dateInput.value;
  message('weight-message','',false);
  fieldError(weightInput,'');fieldError(dateInput,'');
  if(rawWeight===''||!isFinite(displayWeight)||displayWeight<Number(weightInput.min)||displayWeight>Number(weightInput.max)||
     kg<20||kg>400||Math.abs(displayWeight*10-Math.round(displayWeight*10))>1e-8){
    var weightError='Enter a weight from '+weightInput.min+' to '+weightInput.max+' '+weightUnit()+', to one decimal place.';
    message('weight-message',weightError,true);fieldError(weightInput,weightError);weightInput.focus();return;
  }
  var parsedDate=/^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00'):new Date(NaN);
  if(!d||!isFinite(parsedDate.getTime())||iso(parsedDate)!==d){
    var dateError='Choose a valid date.';
    message('weight-message',dateError,true);fieldError(dateInput,dateError);dateInput.focus();return;
  }
  if(d>iso(new Date())){
    var futureError='Weight entries cannot be dated in the future.';
    message('weight-message',futureError,true);fieldError(dateInput,futureError);dateInput.focus();return;
  }
  var previous=S.weights;
  var updated=previous.filter(function(x){return x.date!==d});
  updated.push({date:d,kg:Math.round(kg*10)/10});
  S.weights=updated;
  if(!await save()){
    S.weights=previous;
    message('weight-message','Could not save this weight to your account. Check your connection and try again.',true);
    return;
  }
  weightInput.value='';
  message('weight-message','Weight saved.',false);
  renderWeight();
};
$('wlist').onclick=async function(e){
  var b=e.target.closest('.x');if(!b)return;
  var previous=S.weights;
  S.weights=S.weights.filter(function(x){return x.date!==b.dataset.d});
  if(!await save()){
    S.weights=previous;
    message('weight-message','Could not delete this weight from your account. Check your connection and try again.',true);
  }
  renderWeight();
};
['sgoal','swt'].forEach(function(id){
  $(id).addEventListener('input',function(){
    fieldError($(id),'');
    message('goals-message','',false);
  });
});
$('savegoals').onclick=async function(){
  var calorieInput=$('sgoal'),weightInput=$('swt');
  var rawCalories=calorieInput.value,rawWeight=weightInput.value;
  var calories=Number(rawCalories),displayGoalWeight=rawWeight===''?null:Number(rawWeight);
  var goalWeight=displayGoalWeight===null?null:fromDisplayWeight(displayGoalWeight);
  message('goals-message','',false);
  fieldError(calorieInput,'');fieldError(weightInput,'');
  if(rawCalories===''||!Number.isInteger(calories)||calories<800||calories>6000){
    var calorieError='Enter a whole daily calorie goal from 800 to 6000.';
    message('goals-message',calorieError,true);fieldError(calorieInput,calorieError);calorieInput.focus();return;
  }
  if(displayGoalWeight!==null&&(!isFinite(displayGoalWeight)||displayGoalWeight<Number(weightInput.min)||displayGoalWeight>Number(weightInput.max)||
     goalWeight<20||goalWeight>400||Math.abs(displayGoalWeight*10-Math.round(displayGoalWeight*10))>1e-8)){
    var goalWeightError='Enter a goal weight from '+weightInput.min+' to '+weightInput.max+' '+weightUnit()+', to one decimal place, or leave it blank.';
    message('goals-message',goalWeightError,true);fieldError(weightInput,goalWeightError);weightInput.focus();return;
  }
  var previousGoal=S.goal,previousGoalWeight=S.goalWt;
  S.goal=calories;S.goalWt=goalWeight===null?null:Math.round(goalWeight*10)/10;
  if(!await save()){
    S.goal=previousGoal;S.goalWt=previousGoalWeight;
    message('goals-message','Could not save your goals to your account. Check your connection and try again.',true);
    return;
  }
  message('goals-message','Goals saved.',false);
  renderWeight();renderFood();
};
var scanInput=$('scan');
var scanStatus=$('sres');
var scanPicker=scanInput.parentElement;
var scanPreviewUrl=null;
function scanMessage(message,isError){
  scanStatus.textContent=message;
  scanStatus.className='scan-status'+(isError?' err':'');
}
function resizePhoto(file){
  return createImageBitmap(file).then(function(bitmap){
    var scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    var canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    return new Promise(function(resolve,reject){
      canvas.toBlob(function(blob){
        if(blob)resolve(blob);
        else reject(new Error('Could not prepare this photo. Try another image.'));
      },'image/jpeg',0.82);
    });
  });
}
function blobDataUrl(blob){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onload=function(){resolve(reader.result)};
    reader.onerror=function(){reject(new Error('Could not read this photo.'))};
    reader.readAsDataURL(blob);
  });
}
function getAuthHeaders(){
  return supabaseClient.auth.getSession().then(function(result){
    if(result.error)throw result.error;
    if(!result.data.session)throw new Error('Sign in again to use this feature.');
    return {Authorization:'Bearer '+result.data.session.access_token};
  });
}
async function addScanFood(item,button){
  var name=item.nameInput.value.trim();
  var kcal=Number(item.kcalInput.value);
  if(!name||name.length>60||!Number.isInteger(kcal)||kcal<1||kcal>5000){
    item.feedback.textContent='Enter a food name and calories from 1 to 5000.';
    item.feedback.className='err';
    return;
  }
  if(!await addFood(name,kcal,$('fmeal').value)){
    item.feedback.textContent='Could not save this food to your account. Check your connection and try again.';
    item.feedback.className='err';
    return;
  }
  button.disabled=true;
  button.textContent='Added';
  item.feedback.textContent='Added to today’s log.';
  item.feedback.className='scan-notes';
}
function showScanResults(result,previewUrl){
  scanStatus.textContent='';
  scanStatus.className='scan-status';
  if(previewUrl){
    var image=document.createElement('img');
    image.className='scan-preview';
    image.src=previewUrl;
    image.alt='Photo analyzed for food';
    scanStatus.appendChild(image);
  }
  var notes=document.createElement('p');
  notes.className='scan-notes';
  notes.textContent=result.notes||'Review the estimates; photo-based portions can be inaccurate.';
  scanStatus.appendChild(notes);
  if(!result.foods.length){
    var empty=document.createElement('p');
    empty.className='empty';
    empty.textContent='No food could be identified. Try a clearer photo or add the food manually.';
    scanStatus.appendChild(empty);
    return;
  }
  result.foods.forEach(function(food,index){
    var row=document.createElement('div');
    row.className='scan-item';
    var nameLabel=document.createElement('label');
    nameLabel.className='scan-name';
    nameLabel.textContent='Food';
    var nameInput=document.createElement('input');
    nameInput.type='text';
    nameInput.maxLength=60;
    nameInput.value=food.name;
    nameInput.setAttribute('aria-label','Food name '+(index+1));
    nameLabel.appendChild(nameInput);
    var portion=document.createElement('span');
    portion.className='scan-notes';
    portion.textContent='Estimated portion: '+food.portion;
    var kcalLabel=document.createElement('label');
    kcalLabel.textContent='Calories (kcal)';
    var kcalInput=document.createElement('input');
    kcalInput.type='number';
    kcalInput.inputMode='numeric';
    kcalInput.min='1';
    kcalInput.max='5000';
    kcalInput.step='1';
    kcalInput.value=food.calories;
    kcalInput.setAttribute('aria-label','Calories for '+food.name);
    kcalLabel.appendChild(kcalInput);
    var button=document.createElement('button');
    button.type='button';
    button.className='btn';
    button.textContent='Add';
    var feedback=document.createElement('span');
    feedback.setAttribute('role','status');
    var item={nameInput:nameInput,kcalInput:kcalInput,feedback:feedback};
    button.onclick=function(){addScanFood(item,button)};
    row.appendChild(nameLabel);
    row.appendChild(portion);
    row.appendChild(kcalLabel);
    row.appendChild(button);
    row.appendChild(feedback);
    scanStatus.appendChild(row);
  });
}
scanInput.onchange=function(){
  var file=scanInput.files&&scanInput.files[0];
  scanInput.value='';
  if(!file)return;
  if(!file.type||file.type.indexOf('image/')!==0||file.size>15*1024*1024){
    scanMessage('Choose an image smaller than 15 MB.',true);
    return;
  }
  if(scanPreviewUrl){URL.revokeObjectURL(scanPreviewUrl);scanPreviewUrl=null}
  scanStatus.textContent='';
  scanStatus.className='scan-status';
  scanPicker.setAttribute('aria-disabled','true');
  scanInput.disabled=true;
  scanMessage('Preparing photo and asking AI to estimate the food…');
  resizePhoto(file).then(function(blob){
    if(blob.size>3*1024*1024)throw new Error('This photo is still too large to scan. Choose a smaller image.');
    scanPreviewUrl=URL.createObjectURL(blob);
    return blobDataUrl(blob);
  }).then(function(image){
    return getAuthHeaders().then(function(headers){
      headers['Content-Type']='application/json';
      return fetch('/api/scan',{
        method:'POST',
        headers:headers,
        body:JSON.stringify({image:image})
      });
    });
  }).then(function(response){
    return response.json().catch(function(){
      throw new Error('The scan service returned an invalid response.');
    }).then(function(data){
      if(!response.ok)throw new Error(data.error||'Could not scan this photo.');
      return data;
    });
  }).then(function(result){
    showScanResults(result,scanPreviewUrl);
  }).catch(function(error){
    if(scanPreviewUrl){URL.revokeObjectURL(scanPreviewUrl);scanPreviewUrl=null}
    scanMessage((error.message||'Could not scan this photo.')+' You can still search the food list below.',true);
  }).then(function(){
    scanPicker.setAttribute('aria-disabled','false');
    scanInput.disabled=false;
    refreshPlan(true);
  });
};

var chatHistory=[];
var chatPrompts=['How am I doing this week?','What should I eat next?','How can I build a balanced meal?','How does my calorie goal work?'];
var chatInput=$('cin');
var chatSend=$('csend');
var chatMessages=$('msgs');
var chatChips=$('cchips');
chatChips.innerHTML=chatPrompts.map(function(prompt,index){
  return '<button class="chip" type="button" data-prompt="'+index+'">'+esc(prompt)+'</button>';
}).join('');
function addChatMessage(text,role){
  var bubble=document.createElement('div');
  bubble.className='msg '+role;
  bubble.textContent=text;
  chatMessages.appendChild(bubble);
  bubble.scrollIntoView({block:'nearest'});
  return bubble;
}
function coachContext(){
  var foods=S.foods[day]||[];
  var latest=sorted().slice(-1)[0];
  return {
    dailyCalories:S.goal,
    caloriesEaten:foods.reduce(function(total,item){return total+item.kcal},0),
    latestWeight:latest?latest.kg:null,
    goalWeight:S.goalWt,
    waterGlasses:waterCount(day)
  };
}
function sendChatMessage(text){
   text=(text||'').trim();
  if(!text||text.length>300)return;
  chatInput.value='';
  addChatMessage(text,'user');
  var answer;
  try{answer=FitCoach.reply(text,S)}catch(err){answer='Sorry, I could not work that out. Try one of the buttons below.'}
  addChatMessage(answer,'bot');
  chatInput.focus();
}
chatSend.onclick=function(){sendChatMessage(chatInput.value)};
chatInput.addEventListener('keydown',function(event){
  if(event.key==='Enter'&&!event.shiftKey){
    event.preventDefault();
    sendChatMessage(chatInput.value);
  }
});
chatChips.onclick=function(event){
  var button=event.target.closest('button[data-prompt]');
  if(!button)return;
  sendChatMessage(chatPrompts[Number(button.dataset.prompt)]);
};
function hideTracker(){
  $('tabs').hidden=true;
  $('onb').hidden=true;
  $('p-food').hidden=true;
  $('p-wt').hidden=true;
  $('p-coach').hidden=true;
  $('p-settings').hidden=true;
}
function legacyState(){
  try{
    var raw=localStorage.getItem(KEY);
    if(!raw)return null;
    var state=normalizeState(JSON.parse(raw));
    return state.setupComplete||Object.keys(state.foods).length||state.weights.length||Object.keys(state.water).length?state:null;
  }catch(error){
    console.error('Unable to read existing browser tracker data:',error);
    return null;
  }
}
async function loadAccount(user,generation){
  $('app-loading').hidden=false;
  $('loading-message').textContent='Loading your tracker…';
  $('retry-load').hidden=true;
  hideTracker();
  var result=await supabaseClient.from('tracker_data').select('data').eq('user_id',user.id).maybeSingle();
  if(result.error)throw result.error;
  if(generation!==accountGeneration)return;
  if(result.data){
    S=normalizeState(result.data.data);
  }else{
    var oldState=importLegacyOnFirstLogin?legacyState():null;
    S=oldState||defaultState();
    if(!await save())throw new Error('Could not create your tracker record in Supabase.');
    if(oldState)message('sync-status','Imported this browser’s saved tracker into your account.',false);
  }
  if(generation!==accountGeneration)return;
  loadedUserId=user.id;
  loadingUserId=null;
  $('app-loading').hidden=true;
  $('auth').hidden=true;
  $('account-bar').hidden=false;
  $('account-email').textContent=user.email||'Signed in';
  $('onb').hidden=S.setupComplete;
  $('tabs').hidden=!S.setupComplete;
  $('p-food').hidden=!S.setupComplete;
  $('p-wt').hidden=true;
  $('p-coach').hidden=true;
  $('wdate').value=iso(new Date());
  day=iso(new Date());
  if(S.setupComplete)tab('food');
  message('sync-status','Connected to your Supabase account.',false);
  updateSuggestion();
  renderFood();
  renderWeight();
  await verifyPurchaseReturn();
}
async function handleSession(session){
  var user=session&&session.user?session.user:null;
  if(!user){
    accountGeneration++;
    currentUser=null;
    loadedUserId=null;
    loadingUserId=null;
    S=defaultState();
    applyTheme();
    hideTracker();
    $('welcome').hidden=false;
    $('auth-title').hidden=true;
    $('auth').hidden=true;
    $('account-bar').hidden=true;
    $('app-loading').hidden=true;
    message('sync-status','',false);
    return;
  }
  if(currentUser&&currentUser.id===user.id&&(loadedUserId===user.id||loadingUserId===user.id))return;
  accountGeneration++;
  var generation=accountGeneration;
  currentUser=user;
  loadedUserId=null;
  loadingUserId=user.id;
  S=defaultState();
  applyTheme();
  $('welcome').hidden=true;
  $('auth-title').hidden=true;
  $('auth').hidden=true;
  $('account-bar').hidden=false;
  $('account-email').textContent=user.email||'Signed in';
  $('app-loading').hidden=false;
  $('loading-message').textContent='Loading your tracker…';
  $('retry-load').hidden=true;
  hideTracker();
  try{
    await loadAccount(user,generation);
  }catch(error){
    console.error('Unable to load tracker data from Supabase:',error);
    if(generation!==accountGeneration)return;
    loadingUserId=null;
    $('app-loading').hidden=false;
    $('loading-message').textContent='Could not load your tracker. Confirm the Supabase table and row security are set up, then retry. '+error.message;
    $('retry-load').hidden=false;
    message('sync-status','Your tracker data has not been loaded.',true);
  }
}
async function authenticate(action){
  if(!supabaseClient){
    message('auth-status','Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY, then restart the server.',true);
    return;
  }
  if(!$('auth-form').reportValidity())return;
  if(action==='signup'&&!$('consent').checked){
    message('auth-status','Please tick the box to agree to the Terms and Privacy Policy before creating an account.',true);
    return;
  }
  var email=$('auth-email').value.trim();
  var password=$('auth-password').value;
  $('sign-in').disabled=true;
  $('sign-up').disabled=true;
  message('auth-status',action==='signup'?'Creating your account…':'Signing in…',false);
  importLegacyOnFirstLogin=$('import-legacy').checked;
  try{
    var result=action==='signup'
      ?await supabaseClient.auth.signUp({email:email,password:password})
      :await supabaseClient.auth.signInWithPassword({email:email,password:password});
    if(result.error)throw result.error;
    if(action==='signup'&&!result.data.session){
      message('auth-status','Check your email to confirm your account, then return here to sign in.',false);
    }else{
      message('auth-status','Signed in. Loading your private tracker…',false);
    }
  }catch(error){
    message('auth-status',error.message||'Could not authenticate. Check your email, password, and Supabase settings.',true);
  }finally{
    $('sign-in').disabled=false;
    $('sign-up').disabled=false;
  }
}
async function initializeAuth(){
  $('get-started').onclick=function(){
    $('welcome').hidden=true;
    $('auth-title').hidden=false;
    $('auth').hidden=false;
    $('auth-email').focus();
  };
  $('toggle-password').onclick=function(){
    var password=$('auth-password');
    var isVisible=password.type==='password';
    password.type=isVisible?'text':'password';
    $('toggle-password').textContent=isVisible?'Hide':'Show';
    $('toggle-password').setAttribute('aria-label',isVisible?'Hide password':'Show password');
    $('toggle-password').setAttribute('aria-pressed',String(isVisible));
  };
  $('auth-form').onsubmit=function(event){event.preventDefault();authenticate('signin')};
  $('sign-in').onclick=function(){authenticate('signin')};
  $('sign-up').onclick=function(){authenticate('signup')};
  $('sign-out').onclick=async function(){
    $('sign-out').disabled=true;
    try{
      var result=await supabaseClient.auth.signOut();
      if(result.error)message('sync-status','Could not sign out: '+result.error.message,true);
    }catch(error){
      message('sync-status','Could not sign out: '+error.message,true);
    }finally{
      $('sign-out').disabled=false;
    }
  };
  $('retry-load').onclick=function(){
    if(currentUser)handleSession({user:currentUser});
  };
  try{
    var response=await fetch('/api/config',{cache:'no-store'});
    if(!response.ok)throw new Error('Could not load the app configuration.');
    var config=await response.json();
    if(!config.supabaseUrl||!config.supabaseAnonKey){
      message('auth-status','Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY, then restart the server.',true);
      return;
    }
    if(!window.supabase||typeof window.supabase.createClient!=='function'){
      throw new Error('Could not load the Supabase client library. Check your internet connection and refresh.');
    }
    supabaseClient=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);
    supabaseClient.auth.onAuthStateChange(function(event,session){
      if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].indexOf(event)!==-1){
        window.setTimeout(function(){handleSession(session)},0);
      }
    });
    var result=await supabaseClient.auth.getSession();
    if(result.error)throw result.error;
    await handleSession(result.data.session);
  }catch(error){
    console.error('Unable to initialize Supabase authentication:',error);
    message('auth-status',error.message||'Could not connect to Supabase.',true);
  }
}
updateSuggestion();
initializeAuth();
})();
