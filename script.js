var firebaseConfig = { 
    apiKey: "AIzaSyB9XbvwAckW59yxfj3y1MXD9izwC1uww48",
    authDomain: "bahraindelivery-2be5f.firebaseapp.com",
    databaseURL: "https://bahraindelivery-2be5f-default-rtdb.firebaseio.com/",
    projectId: "bahraindelivery-2be5f",
    storageBucket: "bahraindelivery-2be5f.firebasestorage.app",
    messagingSenderId: "1067476878954",
    appId: "1:1067476878954:web:096eaea397030df494ac13"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
var db = firebase.database();
var auth = firebase.auth();

var mapP, markerP, mapD, markerD, isSendingOrder = false;
var masterMethod = ""; 
var BH_BOUNDS = { latMin: 25.70, latMax: 26.40, lngMin: 50.30, lngMax: 50.90 };
var confirmationResult = null;
var currentPendingOrderId = null; 

var currentFlow = ""; 
var tempFullPhone = ""; 
var multiOrdersList = []; 
var addedByProceed = false;

// متغير المؤقت لزر الإعادة
var otpTimer = null;

window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    'size': 'invisible'
});

async function startOtpProcess() {
    var nm = document.getElementById('reg-name').value.trim();
    var ph = document.getElementById('reg-phone').value.trim();
    var ps = document.getElementById('reg-pass').value.trim();
    var pc = document.getElementById('reg-pass-confirm').value.trim();
    var country = document.getElementById('reg-country').value;

    if(!nm || !ph || !ps || !pc) return alert("يرجى ملء جميع الحقول");
    if(ps !== pc) return alert("كلمة المرور غير متطابقة");
    if(ph.length < 7) return alert("رقم الهاتف غير صحيح");

    var fullPhone = country + ph; 
    var btn = document.getElementById('otp-btn');
    btn.disabled = true;
    btn.innerText = "جاري التحقق...";

    db.ref('users/' + fullPhone).once('value', snapshot => {
        if (snapshot.exists()) {
            alert("هاذا الرقم مسجل و فعال");
            btn.disabled = false;
            btn.innerText = "إرسال رمز التحقق";
        } else {
            currentFlow = "register";
            tempFullPhone = fullPhone;
            sendOtpCode(fullPhone, btn);
        }
    });
}

function startForgotProcess() {
    var ph = document.getElementById('forgot-phone').value.trim();
    var country = document.getElementById('forgot-country').value;

    if(!ph) return alert("الرجاء إدخال رقم الهاتف");

    var fullPhone = country + ph; 
    var btn = document.getElementById('forgot-btn');
    btn.disabled = true;
    btn.innerText = "جاري التحقق...";

    db.ref('users/' + fullPhone).once('value', snapshot => {
        if (!snapshot.exists()) {
            alert("هذا الرقم غير مسجل لدينا، تأكد من الرقم والمفتاح");
            btn.disabled = false;
            btn.innerText = "إرسال رمز التحقق";
        } else {
            currentFlow = "forgot";
            tempFullPhone = fullPhone;
            sendOtpCode(fullPhone, btn);
        }
    });
}

// دالة تشغيل عداد 60 ثانية
function startOtpTimer() {
    var resendBtn = document.getElementById('resend-otp-btn');
    resendBtn.disabled = true;
    resendBtn.style.color = "#888";
    var timeLeft = 60;
    resendBtn.innerText = `أرسل مجدداً (${timeLeft})`;

    clearInterval(otpTimer);
    otpTimer = setInterval(() => {
        timeLeft--;
        resendBtn.innerText = `أرسل مجدداً (${timeLeft})`;
        if (timeLeft <= 0) {
            clearInterval(otpTimer);
            resendBtn.innerText = "أرسل مجدداً";
            resendBtn.disabled = false;
            resendBtn.style.color = "var(--benefit-blue)";
        }
    }, 1000);
}

// دالة زر إرسال الرمز مجدداً
function resendOtpCode() {
    var btn = document.getElementById('resend-otp-btn');
    btn.innerText = "جاري الإرسال...";
    btn.disabled = true;
    auth.signInWithPhoneNumber(tempFullPhone, window.recaptchaVerifier)
        .then((result) => {
            confirmationResult = result;
            alert("تم إرسال الرمز مجدداً");
            startOtpTimer();
        }).catch((error) => {
            alert("حدث خطأ، يرجى المحاولة لاحقاً");
            btn.innerText = "أرسل مجدداً";
            btn.disabled = false;
        });
}

function sendOtpCode(fullPhone, btn) {
    btn.innerText = "جاري الإرسال...";
    auth.signInWithPhoneNumber(fullPhone, window.recaptchaVerifier)
        .then((result) => {
            confirmationResult = result;
            document.getElementById('otp-overlay').style.display = 'flex';
            btn.disabled = false;
            btn.innerText = "إرسال رمز التحقق";
            startOtpTimer(); // تشغيل العداد
        }).catch((error) => {
            alert("حدث خطأ في إرسال الرمز، يرجى المحاولة لاحقاً");
            btn.disabled = false;
            btn.innerText = "إرسال رمز التحقق";
        });
}

function verifyOtpCode() {
    var code = document.getElementById('otp-code').value;
    if(!code) return alert("أدخل الرمز");

    // تغيير شكل الزر للرصاصي وجعله غير قابل للضغط
    var vBtn = document.getElementById('verify-otp-btn');
    vBtn.style.background = '#95a5a6';
    vBtn.innerText = 'جاري التأكيد...';
    vBtn.disabled = true;

    confirmationResult.confirm(code).then(() => {
        closeOtpOverlay();
        if (currentFlow === "register") {
            finishRegistration();
        } else if (currentFlow === "forgot") {
            goTo('page-reset-password');
        }
    }).catch(() => {
        alert("الرمز غير صحيح");
        // إرجاع شكل الزر للأحمر إذا فشل التأكيد
        vBtn.style.background = 'var(--red)';
        vBtn.innerText = 'تأكيد الرمز';
        vBtn.disabled = false;
        document.getElementById('otp-code').value = "";
    });
}

function finishRegistration() {
    var nm = document.getElementById('reg-name').value.trim();
    var ps = document.getElementById('reg-pass').value.trim();

    db.ref('users/' + tempFullPhone).set({
        name: nm, 
        password: ps, 
        verified: true,
        createdAt: Date.now()
    }).then(() => {
        alert("تم إنشاء الحساب بنجاح! سجل دخولك الآن.");
        // تفريغ الخانات عند النجاح
        document.getElementById('reg-name').value = "";
        document.getElementById('reg-phone').value = "";
        document.getElementById('reg-pass').value = "";
        document.getElementById('reg-pass-confirm').value = "";
        goTo('page-login');
    });
}

function updatePassword() {
    var p1 = document.getElementById('new-pass').value.trim();
    var p2 = document.getElementById('new-pass-confirm').value.trim();

    if(!p1 || !p2) return alert("يرجى إدخال كلمة المرور");
    if(p1 !== p2) return alert("كلمة المرور غير متطابقة");

    db.ref('users/' + tempFullPhone).update({
        password: p1
    }).then(() => {
        alert("تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.");
        // تفريغ الخانات عند النجاح
        document.getElementById('new-pass').value = "";
        document.getElementById('new-pass-confirm').value = "";
        goTo('page-login');
    }).catch(err => {
        alert("حدث خطأ أثناء التحديث");
    });
}

function secureLogin() {
    var country = document.getElementById('login-country').value;
    var ph = document.getElementById('login-phone').value.trim();
    var ps = document.getElementById('login-pass').value.trim();
    
    if(!ph || !ps) return alert("أدخل بيانات الدخول كاملة");
    
    var fullPhone = country + ph; 

    db.ref('users/' + fullPhone).once('value', s => {
        if(s.exists() && s.val().password === ps) { 
            localStorage.setItem('uPhone', fullPhone); 
            goTo('page-home'); 
            document.getElementById('welcome-msg').innerText = "مرحباً " + (s.val().name || "");
        }
        else alert("خطأ في بيانات الدخول، يرجى المحاولة مرة أخرى.");
    });
}

function closeOtpOverlay() { 
    document.getElementById('otp-overlay').style.display = 'none'; 
    document.getElementById('otp-code').value = ""; // تفريغ الخانة
    clearInterval(otpTimer); // إيقاف العداد
    
    // إرجاع زر التأكيد لشكله الأصلي
    var vBtn = document.getElementById('verify-otp-btn');
    if(vBtn) {
        vBtn.style.background = 'var(--red)';
        vBtn.innerText = 'تأكيد الرمز';
        vBtn.disabled = false;
    }
}

function startNewOrder() {
    currentPendingOrderId = null;
    multiOrdersList = []; 
    currentCheckoutList = [];
    addedByProceed = false;
    document.getElementById('added-orders-badge').style.display = 'none';
    
    var inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        if (input.id !== 'login-phone' && input.id !== 'login-pass') {
            input.value = "";
        }
    });
    
    if (markerP && mapP) { markerP.setMap(null); markerP = null; }
    if (markerD && mapD) { markerD.setMap(null); markerD = null; }
    goTo('page-map-pickup');
}

function goTo(id) {
    // كود تفريغ الخانات في حال الخروج من صفحة التسجيل
    var currentPage = document.querySelector('.active-page');
    if (currentPage && currentPage.id === 'page-register' && id !== 'page-register') {
        document.getElementById('reg-name').value = "";
        document.getElementById('reg-phone').value = "";
        document.getElementById('reg-pass').value = "";
        document.getElementById('reg-pass-confirm').value = "";
    }
    // تفريغ خانة استعادة المرور عند الخروج
    if (currentPage && currentPage.id === 'page-forgot' && id !== 'page-forgot') {
        document.getElementById('forgot-phone').value = "";
    }

    if (id === 'page-info-delivery' && document.getElementById('page-payment').classList.contains('active-page')) {
        if (addedByProceed && multiOrdersList.length > 0) {
            var lastItem = multiOrdersList.pop(); 
            
            document.getElementById('d-phone').value = lastItem.dPhone || "";
            document.getElementById('d-area').value = lastItem.dArea || "";
            document.getElementById('d-block').value = lastItem.dBlock || "";
            document.getElementById('d-road').value = lastItem.dRoad || "";
            document.getElementById('d-house').value = lastItem.dHouse || "";
            document.getElementById('d-type').value = lastItem.dType || "";
            document.getElementById('d-link').value = lastItem.dLink || "";
            document.getElementById('d-collection').value = (lastItem.dCollection && lastItem.dCollection !== "0") ? lastItem.dCollection : "";
            
            if (lastItem.lat && lastItem.lng) {
                var loc = new google.maps.LatLng(lastItem.lat, lastItem.lng);
                if (markerD) markerD.setMap(null);
                if (mapD) {
                    markerD = new google.maps.Marker({ map: mapD, position: loc });
                    mapD.setCenter(loc);
                }
            }
            addedByProceed = false;
        }
        
        var badge = document.getElementById('added-orders-badge');
        if(badge) {
            if(multiOrdersList.length > 0) {
                badge.style.display = 'block';
                document.getElementById('orders-counter').innerText = multiOrdersList.length;
            } else {
                badge.style.display = 'none';
            }
        }
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.getElementById(id).classList.add('active-page');
    if(id === 'page-map-pickup') {
        initMap('map-pickup', 'p');
        if(mapP) setTimeout(() => google.maps.event.trigger(mapP, 'resize'), 400);
    }
    if(id === 'page-map-delivery') {
        initMap('map-delivery', 'd');
        if(mapD) setTimeout(() => google.maps.event.trigger(mapD, 'resize'), 400);
    }
}

function initMap(divId, type) {
    setTimeout(() => {
        var bahrainCenter = { lat: 26.2285, lng: 50.5860 };
        var mapOptions = { zoom: 12, center: bahrainCenter, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'greedy' };

        if (type === 'p' && !mapP) {
            mapP = new google.maps.Map(document.getElementById(divId), mapOptions);
            var input = document.createElement('input');
            input.type = 'text'; input.placeholder = 'ابحث عن مطعم، محل، مستشفى...'; input.className = 'google-search-box';
            mapP.controls[google.maps.ControlPosition.TOP_CENTER].push(input);
            var autocomplete = new google.maps.places.Autocomplete(input, { componentRestrictions: { country: "bh" } });
            autocomplete.bindTo('bounds', mapP);

            autocomplete.addListener('place_changed', () => {
                var place = autocomplete.getPlace();
                if (!place.geometry || !place.geometry.location) return;
                if (markerP) markerP.setMap(null);
                markerP = new google.maps.Marker({ map: mapP, position: place.geometry.location });
                mapP.setCenter(place.geometry.location); mapP.setZoom(16);
            });

            mapP.addListener('click', e => {
                if (markerP) markerP.setMap(null);
                markerP = new google.maps.Marker({ map: mapP, position: e.latLng });
            });
        } else if (type === 'd' && !mapD) {
            mapD = new google.maps.Map(document.getElementById(divId), mapOptions);
            var input = document.createElement('input');
            input.type = 'text'; input.placeholder = 'ابحث عن مطعم، محل، مستشفى...'; input.className = 'google-search-box';
            mapD.controls[google.maps.ControlPosition.TOP_CENTER].push(input);
            var autocomplete = new google.maps.places.Autocomplete(input, { componentRestrictions: { country: "bh" } });
            autocomplete.bindTo('bounds', mapD);

            autocomplete.addListener('place_changed', () => {
                var place = autocomplete.getPlace();
                if (!place.geometry || !place.geometry.location) return;
                if (markerD) markerD.setMap(null);
                markerD = new google.maps.Marker({ map: mapD, position: place.geometry.location });
                mapD.setCenter(place.geometry.location); mapD.setZoom(16);
            });

            mapD.addListener('click', e => {
                if (markerD) markerD.setMap(null);
                markerD = new google.maps.Marker({ map: mapD, position: e.latLng });
            });
        }
    }, 300);
}

function getCurrentLocation(type) {
    if (!navigator.geolocation) return alert("المتصفح لا يدعم GPS");
    navigator.geolocation.getCurrentPosition(pos => {
        var lat = pos.coords.latitude; var lng = pos.coords.longitude;
        if (lat >= BH_BOUNDS.latMin && lat <= BH_BOUNDS.latMax && lng >= BH_BOUNDS.lngMin && lng <= BH_BOUNDS.lngMax) {
            var loc = { lat: lat, lng: lng };
            if (type === 'p') {
                if(markerP) markerP.setMap(null);
                markerP = new google.maps.Marker({ map: mapP, position: loc }); 
                mapP.setCenter(loc); mapP.setZoom(17);
            } else {
                if(markerD) markerD.setMap(null);
                markerD = new google.maps.Marker({ map: mapD, position: loc }); 
                mapD.setCenter(loc); mapD.setZoom(17);
            }
        } else { alert("موقعك خارج حدود البحرين"); }
    }, () => alert("فشل تحديد الموقع - تأكد من تشغيل الموقع في هاتفك"), {enableHighAccuracy: true});
}

function confirmStep(step) {
    if (step === 'pickup' && !markerP) return alert("حدد موقع الاستلام على الخريطة أولاً");
    if (step === 'delivery' && !markerD) return alert("حدد موقع التسليم على الخريطة أولاً");
    goTo(step === 'pickup' ? 'page-info-pickup' : 'page-info-delivery');
}

function isOutsideBahrain(lat, lng) {
    return (lat < BH_BOUNDS.latMin || lat > BH_BOUNDS.latMax || lng < BH_BOUNDS.lngMin || lng > BH_BOUNDS.lngMax);
}

function processCurrentDeliveryData() {
    if(!markerP || !markerD) return { error: "يرجى تحديد المواقع أولاً" };
    
    var dPhone = document.getElementById('d-phone').value.trim();
    var dArea = document.getElementById('d-area').value.trim();
    var dBlock = document.getElementById('d-block').value.trim();
    var dRoad = document.getElementById('d-road').value.trim();
    var dHouse = document.getElementById('d-house').value.trim();
    var dCollection = document.getElementById('d-collection').value.trim();

    if(!dPhone || !dArea || !dBlock || !dRoad || !dHouse) {
        return { error: "يرجى إكمال جميع بيانات التسليم الإجبارية" };
    }

    var latP = markerP.getPosition().lat();
    var lngP = markerP.getPosition().lng();
    var latD = markerD.getPosition().lat();
    var lngD = markerD.getPosition().lng();

    if (isOutsideBahrain(latP, lngP) || isOutsideBahrain(latD, lngD)) {
        return { error: "OUT_OF_BOUNDS" };
    }

    var rawDist = google.maps.geometry.spherical.computeDistanceBetween(markerP.getPosition(), markerD.getPosition()) / 1000;
    var distForPricing = Math.ceil(rawDist);
    var calcPrice = 0;

    if (distForPricing <= 6) calcPrice = 1.000;
    else if (distForPricing <= 10) calcPrice = 1.800;
    else if (distForPricing <= 15) calcPrice = 2.200;
    else if (distForPricing <= 20) calcPrice = 2.500;
    else {
        var extraKm = distForPricing - 20;
        calcPrice = 2.500 + (extraKm * 0.050);
    }

    return {
        dPhone: dPhone, dArea: dArea, dBlock: dBlock, dRoad: dRoad, dHouse: dHouse,
        dType: document.getElementById('d-type').value.trim(),
        dLink: document.getElementById('d-link').value.trim(),
        dCollection: dCollection || "0",
        lat: latD, lng: lngD,
        price: calcPrice.toFixed(3),
        method: '' 
    };
}

function addAnotherDelivery() {
    var data = processCurrentDeliveryData();
    
    if (data.error === "OUT_OF_BOUNDS") {
        alert("لا يمكن إضافة طلبات خارج البحرين في سلة الطلبات المتعددة. يرجى إرساله كطلب منفصل.");
        return;
    }
    if (data.error) return alert(data.error);

    multiOrdersList.push(data);
    addedByProceed = false;
    
    document.getElementById('added-orders-badge').style.display = 'block';
    document.getElementById('orders-counter').innerText = multiOrdersList.length;

    document.getElementById('d-phone').value = "";
    document.getElementById('d-area').value = "";
    document.getElementById('d-block').value = "";
    document.getElementById('d-road').value = "";
    document.getElementById('d-house').value = "";
    document.getElementById('d-type').value = "";
    document.getElementById('d-link').value = "";
    document.getElementById('d-collection').value = "";
    if (markerD) { markerD.setMap(null); markerD = null; }
    
    alert("تم حفظ الطلب في السلة! الرجاء تحديد موقع التسليم للطلب الجديد.");
    goTo('page-map-delivery');
}

function proceedToPayment() {
    var dPhone = document.getElementById('d-phone').value.trim();
    var dArea = document.getElementById('d-area').value.trim();
    
    currentCheckoutList = [...multiOrdersList]; 

    if (dPhone || dArea) {
        var data = processCurrentDeliveryData();
        
        if (data.error === "OUT_OF_BOUNDS" && multiOrdersList.length === 0) {
            document.getElementById('out-of-bounds-overlay').style.display = 'flex';
            return;
        }
        if (data.error === "OUT_OF_BOUNDS" && multiOrdersList.length > 0) {
            return alert("لا يمكن دمج طلب خارج البحرين مع طلبات داخلية. يرجى إرسال السلة الحالية أولاً.");
        }
        if (data.error) return alert(data.error);

        currentCheckoutList.push(data);
        addedByProceed = true; 
    } else if (currentCheckoutList.length === 0) {
        return alert("يرجى إكمال بيانات التسليم أولاً");
    } else {
        addedByProceed = false; 
    }

    renderCartAndPaymentUI();
    goTo('page-payment');
}

function removeDeliveryFromCart(index) {
    if(confirm("هل أنت متأكد من حذف هذا الطلب من السلة؟")) {
        multiOrdersList.splice(index, 1); 
        
        var badge = document.getElementById('added-orders-badge');
        if(badge) {
            if(multiOrdersList.length > 0) {
                badge.style.display = 'block';
                document.getElementById('orders-counter').innerText = multiOrdersList.length;
            } else {
                badge.style.display = 'none';
            }
        }

        if(multiOrdersList.length === 0) {
            alert("السلة فارغة الآن، يرجى إضافة موقع تسليم جديد.");
            goTo('page-map-delivery'); 
        } else {
            renderCartAndPaymentUI(); 
        }
    }
}

function renderCartAndPaymentUI() {
    var listHtml = '';
    var total = 0;
    
    currentCheckoutList.forEach((order, index) => {
        total += parseFloat(order.price);
        listHtml += `
        <div class="card" style="margin-bottom:10px; padding:15px; position:relative;">
            <button onclick="removeDeliveryFromCart(${index})" style="position:absolute; top:15px; left:15px; background:none; border:none; color:#DA291C; font-size:18px; cursor:pointer; padding:5px;" title="حذف الطلب">
                <i class="fas fa-trash-alt"></i>
            </button>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div style="padding-left: 30px;">
                    <b style="font-size:16px;">طلب ${index + 1}</b><br>
                    <small style="color:#666;">تأكيد هاتف التسليم: <span dir="ltr" style="font-weight:bold; color:#333;">${order.dPhone}</span></small>
                </div>
                <div style="text-align:left;">
                    <b style="color:var(--red); font-size:18px;">${order.price} د.ب</b>
                </div>
            </div>
            
            <div class="individual-pay-section" id="indiv-pay-${index}">
                <p style="font-size:13px; margin:0 0 8px 0; color:#555;">اختر طريقة الدفع لهذا الطلب:</p>
                <div class="pay-methods" style="margin:0;">
                    <div id="btn-cash-${index}" class="pay-btn ${order.method === 'Cash' ? 'selected-cash' : ''}" onclick="selectIndivPay(${index}, 'Cash')" style="padding:10px; font-size:14px;"><i class="fas fa-money-bill-wave"></i> كاش</div>
                    <div id="btn-benefit-${index}" class="pay-btn ${order.method === 'Benefit' ? 'selected-benefit' : ''}" onclick="selectIndivPay(${index}, 'Benefit')" style="padding:10px; font-size:14px;"><i class="fas fa-university"></i> بنفت</div>
                </div>
            </div>
        </div>`;
    });
    
    document.getElementById('cart-orders-list').innerHTML = listHtml;
    document.getElementById('cart-total-price').innerText = total.toFixed(3);
    
    if (currentCheckoutList.length > 1) {
        document.getElementById('dist-info').innerText = "تم دمج " + currentCheckoutList.length + " طلبات في سلة واحدة";
        document.getElementById('select-all-wrapper').style.display = 'block';
    } else {
        document.getElementById('dist-info').innerText = "تم حساب السعر بنجاح";
        document.getElementById('select-all-wrapper').style.display = 'none'; 
    }
    
    document.getElementById('select-all-checkbox').checked = false;
    toggleSelectAll();
    checkPaymentReadiness();
}

function selectIndivPay(index, method) {
    if(document.getElementById('select-all-checkbox').checked) return;
    currentCheckoutList[index].method = method;
    document.getElementById(`btn-cash-${index}`).className = 'pay-btn' + (method === 'Cash' ? ' selected-cash' : '');
    document.getElementById(`btn-benefit-${index}`).className = 'pay-btn' + (method === 'Benefit' ? ' selected-benefit' : '');
    checkPaymentReadiness();
}

function toggleSelectAll() {
    var isChecked = document.getElementById('select-all-checkbox').checked;
    var indivSections = document.querySelectorAll('.individual-pay-section');
    
    indivSections.forEach(sec => sec.style.display = isChecked ? 'none' : 'block');
    document.getElementById('master-pay-methods').style.display = isChecked ? 'block' : 'none';
    
    if(isChecked) {
        masterMethod = "";
        document.getElementById('btn-master-cash').className = 'pay-btn';
        document.getElementById('btn-master-benefit').className = 'pay-btn';
        currentCheckoutList.forEach((o, i) => {
            o.method = '';
            document.getElementById(`btn-cash-${i}`).className = 'pay-btn';
            document.getElementById(`btn-benefit-${i}`).className = 'pay-btn';
        });
    } else {
        masterMethod = "";
    }
    checkPaymentReadiness();
}

function selectMasterPay(method) {
    masterMethod = method;
    document.getElementById('btn-master-cash').className = 'pay-btn' + (method === 'Cash' ? ' selected-cash' : '');
    document.getElementById('btn-master-benefit').className = 'pay-btn' + (method === 'Benefit' ? ' selected-benefit' : '');
    
    currentCheckoutList.forEach(o => o.method = method);
    checkPaymentReadiness();
}

function checkPaymentReadiness() {
    if (currentPendingOrderId !== null) {
        var btn = document.getElementById('final-send-btn');
        if (masterMethod !== '') {
            btn.disabled = false;
            btn.style.opacity = "1";
            document.getElementById('ben-box').style.display = (masterMethod === 'Benefit') ? 'block' : 'none';
        } else {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            document.getElementById('ben-box').style.display = 'none';
        }
        return; 
    }

    var allSet = currentCheckoutList.every(o => o.method !== '');
    var anyBenefit = currentCheckoutList.some(o => o.method === 'Benefit');
    
    var totalBen = 0, totalCash = 0;
    currentCheckoutList.forEach(o => {
        if(o.method === 'Benefit') totalBen += parseFloat(o.price);
        if(o.method === 'Cash') totalCash += parseFloat(o.price);
    });

    var summaryEl = document.getElementById('bill-split-summary');
    if(summaryEl) {
        if (allSet && currentCheckoutList.length > 0) {
            summaryEl.style.display = 'block';
            document.getElementById('summary-ben').innerText = totalBen.toFixed(3) + " د.ب";
            document.getElementById('summary-cash').innerText = totalCash.toFixed(3) + " د.ب";
        } else {
            summaryEl.style.display = 'none';
        }
    }
    
    document.getElementById('ben-box').style.display = anyBenefit ? 'block' : 'none';
    
    var btn = document.getElementById('final-send-btn');
    if (allSet && currentCheckoutList.length > 0) {
        btn.disabled = false;
        btn.style.opacity = "1";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.5";
    }
}

async function preSendCheck() {
    var imgData = "";
    var anyBenefit = currentCheckoutList.some(o => o.method === 'Benefit');
    
    if(anyBenefit || masterMethod === 'Benefit') {
        var file = document.getElementById('pay-img').files[0];
        if(!file) return alert("يرجى إرفاق صورة التحويل البنكي (بنفت)");
        imgData = await new Promise(r => { var rd = new FileReader(); rd.readAsDataURL(file); rd.onload = () => r(rd.result); });
    }
    sendNow(imgData);
}

function sendNow(img) {
    if (isSendingOrder) return;
    
    if (currentPendingOrderId) {
        isSendingOrder = true;
        var btn = document.getElementById('final-send-btn');
        btn.disabled = true; btn.innerText = "جاري الاعتماد...";

        db.ref('orders/' + currentPendingOrderId).update({
            status: 'waiting', 
            method: masterMethod,
            proofImage: img || ""
        }).then(() => {
            isSendingOrder = false;
            currentPendingOrderId = null; 
            goTo('page-success');
        }).catch(() => { isSendingOrder = false; btn.disabled = false; btn.innerText = "اعتماد الطلب الآن 🚀"; });
        return;
    }

    isSendingOrder = true;
    var btn = document.getElementById('final-send-btn');
    btn.disabled = true; btn.innerText = "جاري الإرسال...";

    var pPhone = document.getElementById('p-phone').value.trim();
    var pArea = document.getElementById('p-area').value.trim();
    var pBlock = document.getElementById('p-block').value.trim();
    var pRoad = document.getElementById('p-road').value.trim();
    var pHouse = document.getElementById('p-house').value.trim();
    var pType = document.getElementById('p-type').value;
    var pLink = document.getElementById('p-link').value;
    var pickupLocationStr = `http://googleusercontent.com/maps.google.com/?q=${markerP.getPosition().lat()},${markerP.getPosition().lng()}`;

    var orderId = "ORD" + Date.now();
    var totalDeliveryPrice = currentCheckoutList.reduce((sum, o) => sum + parseFloat(o.price), 0);

    var data = {
        id: orderId,
        user: localStorage.getItem('uPhone'), 
        status: 'waiting',
        isBundle: true, 
        deliveries: currentCheckoutList, 
        proofImage: img || "",
        price: totalDeliveryPrice.toFixed(3),
        pPhone: pPhone, pArea: pArea, pRoad: pRoad, pBlock: pBlock, pHouse: pHouse, pType: pType, pLink: pLink,
        pickup: pickupLocationStr,
        timestamp: Date.now()
    };

    db.ref('orders/' + orderId).set(data).then(() => {
        isSendingOrder = false;
        addedByProceed = false;
        multiOrdersList = []; 
        currentCheckoutList = [];
        goTo('page-success');
    }).catch(() => { 
        isSendingOrder = false; 
        btn.disabled = false; 
        btn.innerText = "إرسال الطلبات الآن 🚀"; 
    });
}

function submitForPricing() {
    if (isSendingOrder) return;
    document.getElementById('out-of-bounds-overlay').style.display = 'none';
    isSendingOrder = true;
    
    var pPhone = document.getElementById('p-phone').value.trim();
    var pArea = document.getElementById('p-area').value.trim();
    var pBlock = document.getElementById('p-block').value.trim();
    var pRoad = document.getElementById('p-road').value.trim();
    var pHouse = document.getElementById('p-house').value.trim();
    
    var dPhone = document.getElementById('d-phone').value.trim();
    var dArea = document.getElementById('d-area').value.trim();
    var dBlock = document.getElementById('d-block').value.trim();
    var dRoad = document.getElementById('d-road').value.trim();
    var dHouse = document.getElementById('d-house').value.trim();
    var dCollection = document.getElementById('d-collection').value.trim();

    var orderId = "ORD" + Date.now();
    var data = {
        id: orderId,
        user: localStorage.getItem('uPhone'), 
        status: 'pending_pricing', 
        method: '',
        proofImage: '',
        price: "0", 
        collectionAmount: dCollection || "0",
        pPhone: pPhone, pArea: pArea, pRoad: pRoad, pBlock: pBlock, pHouse: pHouse,
        pType: document.getElementById('p-type').value,
        pLink: document.getElementById('p-link').value,
        pickup: `http://googleusercontent.com/maps.google.com/?q=${markerP.getPosition().lat()},${markerP.getPosition().lng()}`,
        dPhone: dPhone, dArea: dArea, dRoad: dRoad, dBlock: dBlock, dHouse: dHouse,
        dType: document.getElementById('d-type').value,
        dLink: document.getElementById('d-link').value,
        dropoff: `http://googleusercontent.com/maps.google.com/?q=${markerD.getPosition().lat()},${markerD.getPosition().lng()}`,
        timestamp: Date.now()
    };

    db.ref('orders/' + orderId).set(data).then(() => {
        isSendingOrder = false;
        alert("تم إرسال الطلب للإدارة بنجاح. يرجى الانتظار ومتابعة الطلب من 'طلباتي السابقة'.");
        goTo('page-home');
    }).catch(() => { isSendingOrder = false; alert("خطأ في إرسال الطلب"); });
}

function logout() {
    localStorage.clear();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    var loginPage = document.getElementById('page-login');
    if (loginPage) { loginPage.classList.add('active-page'); }
    if (document.getElementById('login-phone')) document.getElementById('login-phone').value = "";
    if (document.getElementById('login-pass')) document.getElementById('login-pass').value = "";
}

function loadOrders() {
    var userPhone = localStorage.getItem('uPhone');
    var list = document.getElementById('list-container');
    
    list.style.overflowY = "auto"; 
    list.style.maxHeight = "85vh"; 
    list.style.padding = "10px";

    list.innerHTML = "<p style='text-align:center; padding:20px;'>جاري تحميل طلباتك...</p>";

    db.ref('orders').orderByChild('user').equalTo(userPhone).on('value', snap => {
        list.innerHTML = "";
        if (!snap.exists()) { 
            list.innerHTML = "<p style='text-align:center;'>لا توجد طلبات</p>"; 
            return; 
        }

        var orders = []; 
        snap.forEach(c => { var o = c.val(); o.key = c.key; orders.push(o); });

        orders.reverse().forEach(o => {
            var statusText = "";
            var statusColor = "var(--red)"; 

            if (o.status === 'waiting') statusText = "بانتظار قبول المندوب";
            else if (o.status === 'pending_pricing') { statusText = "بانتظار تسعير الإدارة ⏳"; statusColor = "#f39c12"; }
            else if (o.status === 'priced') { statusText = "تم تحديد السعر - بانتظار الدفع 💳"; statusColor = "#005EB8"; }
            else if (o.status === 'accepted') statusText = "قيد التنفيذ 🚚";
            else if (o.status === 'picked_up') statusText = "تم الاستلام من المحل 🛍️";
            else if (o.status === 'completed' || o.status === 'finished') { statusText = "مكتمل ✅"; statusColor = "#27ae60"; }
            else if (o.status === 'canceled' || o.status === 'cancelled') { statusText = "ملغي ❌"; statusColor = "#888"; }

            var cardStyle = (o.status === 'canceled' || o.status === 'cancelled') ? "opacity: 0.7; border-right: 5px solid #888;" : `border-right: 5px solid ${statusColor};`;
            
            var bundleLabel = o.isBundle && o.deliveries && o.deliveries.length > 1 ? `<span style="background:#f39c12; color:white; padding:2px 8px; border-radius:10px; font-size:12px; margin-right:5px;">مجمع (${o.deliveries.length})</span>` : '';

            list.innerHTML += `
                <div class="order-card" onclick='openDetails(${JSON.stringify(o)})' style="background:white; border-radius:15px; margin-bottom:15px; width:100%; border:1px solid #ddd; overflow:hidden; cursor:pointer; flex-shrink: 0; ${cardStyle}">
                    <div style="padding:20px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <b style="font-size:18px;">طلب #${o.key.slice(-5)} ${bundleLabel}</b><br>
                            <small style="color:#888;">إضغط لعرض التفاصيل الكاملة</small>
                        </div>
                        <div style="text-align:left;">
                            <span style="color:${statusColor}; font-weight:bold; font-size:16px;">${statusText}</span>
                        </div>
                    </div>
                </div>`;
        });
    });
}

function openDetails(o) {
    var statusText = "";
    var statusColor = "var(--red)";

    if (o.status === 'waiting') statusText = "بانتظار قبول المندوب";
    else if (o.status === 'pending_pricing') { statusText = "تواصل مع الدعم للموافقة: 33333388-973+ ⏳"; statusColor = "#f39c12"; }
    else if (o.status === 'priced') { statusText = "تم التسعير - يرجى الدفع لاعتماد الطلب 💳"; statusColor = "#005EB8"; }
    else if (o.status === 'accepted') statusText = "الطلب قيد التنفيذ حالياً 🚚";
    else if (o.status === 'picked_up') statusText = "المندوب استلم الطلب وهو في الطريق إليك 📍";
    else if (o.status === 'completed' || o.status === 'finished') { statusText = "تم تسليم الطلب بنجاح ✅"; statusColor = "#27ae60"; }
    else if (o.status === 'canceled' || o.status === 'cancelled') { statusText = "تم إلغاء هذا الطلب ❌"; statusColor = "#888"; }

    var orderTimeText = "غير متوفر";
    if (o.timestamp) {
        var date = new Date(o.timestamp);
        var bhDate = new Date(date.getTime() + (3 * 3600000)); 
        var timeStr = bhDate.toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

        if (timeStr.includes('AM')) {
            timeStr = timeStr.replace('AM', 'PM');
        } else if (timeStr.includes('PM')) {
            timeStr = timeStr.replace('PM', 'AM');
        } else if (timeStr.includes('am')) {
            timeStr = timeStr.replace('am', 'PM');
        } else if (timeStr.includes('pm')) {
            timeStr = timeStr.replace('pm', 'AM');
        }
        orderTimeText = timeStr;
    }

    var cancelBtn = (o.status === 'waiting' || o.status === 'accepted' || o.status === 'pending_pricing' || o.status === 'priced') ? 
        `<button class="btn-red" onclick="cancelOrderNow('${o.key}')" style="width:100%; padding:20px; margin-top:15px; background:#DA291C; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">إلغاء الطلب 🗑️</button>` : "";
    
    var payBtn = (o.status === 'priced') ? 
        `<button class="btn-red" onclick="resumePayment('${o.key}', '${o.price}')" style="width:100%; padding:20px; margin-top:15px; background:#005EB8; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer; box-shadow: 0 5px 15px rgba(0,94,184,0.3);">إكمال الدفع لاعتماد الطلب 💳</button>` : "";
    
    var dName = o.driverName || "سائق توصيل";
    var dPhone = o.driverPhone || o.driver || ""; 

    var driverHtml = "";
    if (dPhone && (o.status !== 'canceled' && o.status !== 'cancelled')) {
        driverHtml = `
        <div class="info-card-huge" style="border-right: 5px solid #005EB8; background:#e3f2fd; padding:15px; border-radius:12px; margin-bottom:15px;">
            <b style="color:#005EB8; font-size:18px;">بيانات المندوب المسؤول:</b>
            <p style="font-size:20px; margin:10px 0; font-weight:bold;">${dName}</p>
            <p style="font-size:18px; color:#333; margin-bottom:15px;">📞 هاتف المندوب: <b>${dPhone}</b></p>
            <a href="tel:${dPhone}" style="display:block; text-align:center; padding:15px; background:#27ae60; color:white; border-radius:10px; text-decoration:none; font-weight:bold; font-size:18px;">اتصال مباشر بالمندوب 📞</a>
        </div>`;
    }

    var benefitImageHtml = "";
    if ((o.method === 'Benefit' || (o.isBundle && o.proofImage)) && o.proofImage) {
        benefitImageHtml = `
        <div class="info-card-huge" style="padding:15px; border-radius:12px; margin-bottom:15px; border-right:5px solid #005EB8; background:#f0f7ff; text-align:center;">
            <b style="color:#005EB8; font-size:16px; display:block; margin-bottom:10px;">🖼️ صورة إثبات الدفع (بنفت):</b>
            <img src="${o.proofImage}" style="width:100%; border-radius:10px; border:1px solid #ddd; box-shadow: 0 2px 5px rgba(0,0,0,0.1);" onclick="window.open(this.src)">
            <small style="display:block; margin-top:5px; color:#666;">إضغط على الصورة لتكبيرها</small>
        </div>`;
    }

    var productPrice = 0;
    var deliveryPrice = parseFloat(o.price || 0); 
    var deliveryDetailsHtml = "";

    if (o.isBundle && o.deliveries) {
        o.deliveries.forEach((del, idx) => {
            productPrice += parseFloat(del.dCollection || 0);
            deliveryDetailsHtml += `
            <div class="info-card-huge" style="padding:15px; border-radius:12px; margin-bottom:15px; border-right:5px solid var(--success); background:#f9fff9;">
                <b style="color:var(--success); font-size:16px;">🏁 تفاصيل موقع التسليم ${idx + 1} (${del.method === 'Benefit' ? 'بنفت 💳' : 'كاش 💵'}):</b>
                <p style="margin:8px 0;"><b>المنطقة:</b> ${del.dArea}</p>
                <p style="margin:5px 0;"><b>مجمع:</b> ${del.dBlock || '-'} | <b>طريق:</b> ${del.dRoad || '-'} | <b>منزل:</b> ${del.dHouse || '-'}</p>
                ${del.dType ? `<p style="margin:5px 0;"><b>شقة/طابق:</b> ${del.dType}</p>` : ''}
                <p style="margin:5px 0;">📞 هاتف التسليم: <span dir="ltr">${del.dPhone}</span></p>
                ${del.dLink ? `<a href="${del.dLink}" target="_blank" style="color:#27ae60; display:block; margin-top:5px; font-weight:bold;">🔗 فتح رابط الموقع (GPS)</a>` : ''}
            </div>`;
        });
    } else {
        productPrice = parseFloat(o.collectionAmount || 0);
        deliveryDetailsHtml = `
        <div class="info-card-huge" style="padding:15px; border-radius:12px; margin-bottom:15px; border-right:5px solid var(--success); background:#f9fff9;">
            <b style="color:var(--success); font-size:18px;">🏁 تفاصيل موقع التسليم:</b>
            <p style="margin:8px 0;"><b>المنطقة:</b> ${o.dArea}</p>
            <p style="margin:5px 0;"><b>مجمع:</b> ${o.dBlock || '-'} | <b>طريق:</b> ${o.dRoad || '-'} | <b>منزل:</b> ${o.dHouse || '-'}</p>
            ${o.dType ? `<p style="margin:5px 0;"><b>شقة/طابق:</b> ${o.dType}</p>` : ''}
            <p style="margin:5px 0;">📞 هاتف التسليم: <span dir="ltr">${o.dPhone}</span></p>
            ${o.dLink ? `<a href="${o.dLink}" target="_blank" style="color:#27ae60; display:block; margin-top:5px; font-weight:bold;">🔗 فتح رابط الموقع (GPS)</a>` : ''}
        </div>`;
    }

    var totalToPay = deliveryPrice + productPrice; 

    var detailsArea = document.getElementById('details-render-area');
    if(detailsArea) {
        detailsArea.style.maxHeight = "75vh"; 
        detailsArea.style.overflowY = "auto";
        detailsArea.style.paddingRight = "5px";

        detailsArea.innerHTML = `
            <div class="info-card-huge" style="padding:15px; background:#f9f9f9; border-radius:12px; margin-bottom:15px; border-right:5px solid #333;">
                <b>رقم الطلب المرجعي:</b>
                <p style="word-break:break-all; margin:5px 0; font-family:monospace;">${o.key}</p>
                <p style="margin:5px 0; font-size:14px; color:#555;"><b>تاريخ ووقت الطلب:</b> <span style="font-weight:bold; color:var(--red);">${orderTimeText}</span></p>
                ${!o.isBundle ? `<small><b>طريقة الدفع:</b> ${o.method === 'Benefit' ? 'بنفت 💳' : (o.method === 'Cash' ? 'كاش 💵' : 'لم يتم الدفع بعد')}</small>` : ''}
            </div>

            ${benefitImageHtml}
            <div class="info-card-huge" style="padding:15px; border-radius:12px; margin-bottom:15px; border-right:5px solid var(--red); background:#fff9f9;">
                <b style="color:var(--red); font-size:18px;">📍 تفاصيل موقع الاستلام:</b>
                <p style="margin:8px 0;"><b>المنطقة:</b> ${o.pArea}</p>
                <p style="margin:5px 0;"><b>مجمع:</b> ${o.pBlock || '-'} | <b>طريق:</b> ${o.pRoad || '-'} | <b>منزل:</b> ${o.pHouse || '-'}</p>
                ${o.pType ? `<p style="margin:5px 0;"><b>شقة/طابق:</b> ${o.pType}</p>` : ''}
                <p style="margin:5px 0;">📞 هاتف المحل: <span dir="ltr">${o.pPhone}</span></p>
                ${o.pLink ? `<a href="${o.pLink}" target="_blank" style="color:#005EB8; display:block; margin-top:5px; font-weight:bold;">🔗 فتح رابط الموقع (GPS)</a>` : ''}
            </div>

            ${deliveryDetailsHtml}

            <div style="background:#fff5f5; border-radius:20px; border:2px dashed var(--red); padding:20px; margin-bottom:20px; text-align:center;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:16px; color:#555;">
                    <span>إجمالي المبالغ للتحصيل (المنتجات):</span>
                    <b>${productPrice.toFixed(3)} د.ب</b>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:16px; color:#555;">
                    <span>إجمالي رسوم التوصيل:</span>
                    <b>${deliveryPrice.toFixed(3)} د.ب</b>
                </div>
                <hr style="border:0; border-top:1px solid #ffcccc; margin:10px 0;">
                <span style="font-size:14px; color:#888;">المبلغ الإجمالي المطلوب من الزبائن</span><br>
                <b style="font-size:32px; color:var(--red);">${totalToPay.toFixed(3)} د.ب</b>
            </div>

            <div class="info-card-huge" style="padding:15px; background:#eee; border-radius:12px; margin-bottom:15px; text-align:center;">
                <b>حالة الطلب:</b>
                <p style="font-size:22px; font-weight:bold; color:${statusColor}; margin:5px 0;">${statusText}</p>
            </div>

            ${driverHtml}
            ${payBtn}
            ${cancelBtn}
            <div style="height:20px;"></div> `;
    }
    
    document.getElementById('full-details-overlay').style.display = 'block';
}

function resumePayment(key, price) {
    currentPendingOrderId = key;
    document.getElementById('cart-orders-list').innerHTML = ''; 
    document.getElementById('cart-total-price').innerText = parseFloat(price).toFixed(3);
    document.getElementById('dist-info').innerText = "تم التسعير والموافقة من الإدارة (الدفع بنفت فقط)";
    
    document.getElementById('select-all-wrapper').style.display = 'none';
    document.getElementById('master-pay-methods').style.display = 'block';
    document.getElementById('master-pay-title').innerText = "اختر طريقة الدفع:";
    
    // إخفاء زر الكاش تماماً للطلبات المسعرة من الإدارة (خارج البحرين)
    document.getElementById('btn-master-cash').style.display = 'none';
    document.getElementById('btn-master-benefit').style.display = 'inline-block';
    
    masterMethod = "";
    document.getElementById('btn-master-cash').className = 'pay-btn';
    document.getElementById('btn-master-benefit').className = 'pay-btn';
    document.getElementById('ben-box').style.display = 'none';
    
    var sendBtn = document.getElementById('final-send-btn');
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.5";
    sendBtn.innerText = "اعتماد الطلب الآن 🚀";

    closeDetails();
    goTo('page-payment');
}

function cancelOrderNow(key) {
    if(confirm("هل أنت متأكد من إلغاء الطلب؟")) {
        db.ref('orders/' + key).update({ 
            status: 'cancelled',
            driver: null,         
            driverPhone: null,
            driverName: null,
            canceledBy: 'user' 
        })
        .then(() => { 
            alert("تم إلغاء الطلب بنجاح"); 
            closeDetails(); 
        })
        .catch(() => { alert("عذراً، حدث خطأ أثناء الإلغاء"); });
    }
}

function closeDetails() {
    document.getElementById('full-details-overlay').style.display = 'none';
}