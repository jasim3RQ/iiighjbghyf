// --- دالة تسجيل الخروج المحدثة لتجنب خطأ CodePen ---
function logout() {
    localStorage.clear();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    const loginPage = document.getElementById('page-login');
    if (loginPage) {
        loginPage.classList.add('active-page');
    }
    if (document.getElementById('login-phone')) document.getElementById('login-phone').value = "";
    if (document.getElementById('login-pass')) document.getElementById('login-pass').value = "";
    console.log("تم تسجيل الخروج بنجاح");
}

// --- دالة تحميل الطلبات مع الحفاظ على الهيكل ---
function loadOrders() {
    let userPhone = localStorage.getItem('uPhone');
    let list = document.getElementById('list-container');
    
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

        let orders = []; 
        snap.forEach(c => { 
            let o = c.val(); o.key = c.key; orders.push(o); 
        });

        orders.reverse().forEach(o => {
            let statusText = "";
            let statusColor = "var(--red)"; 

            if (o.status === 'waiting') statusText = "بانتظار مندوب";
            else if (o.status === 'accepted') statusText = "قيد التنفيذ 🚚";
            else if (o.status === 'picked_up') statusText = "تم الاستلام من المحل 🛍️";
            else if (o.status === 'completed' || o.status === 'finished') { statusText = "مكتمل ✅"; statusColor = "#27ae60"; }
            else if (o.status === 'canceled' || o.status === 'cancelled') { statusText = "ملغي ❌"; statusColor = "#888"; }

            let cardStyle = (o.status === 'canceled' || o.status === 'cancelled') ? "opacity: 0.7; border-right: 5px solid #888;" : `border-right: 5px solid ${statusColor};`;

            list.innerHTML += `
                <div class="order-card" onclick='openDetails(${JSON.stringify(o)})' style="background:white; border-radius:15px; margin-bottom:15px; width:100%; border:1px solid #ddd; overflow:hidden; cursor:pointer; flex-shrink: 0; ${cardStyle}">
                    <div style="padding:20px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <b style="font-size:18px;">طلب #${o.key.slice(-5)}</b><br>
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

// --- دالة عرض تفاصيل الطلب (المحدثة بإضافة سعر المنتج والحساب الإجمالي) ---
function openDetails(o) {
    let statusText = "";
    let statusColor = "var(--red)";

    if (o.status === 'waiting') statusText = "بانتظار قبول المندوب";
    else if (o.status === 'accepted') statusText = "الطلب قيد التنفيذ حالياً 🚚";
    else if (o.status === 'picked_up') statusText = "المندوب استلم الطلب وهو في الطريق إليك 📍";
    else if (o.status === 'completed' || o.status === 'finished') { statusText = "تم تسليم الطلب بنجاح ✅"; statusColor = "#27ae60"; }
    else if (o.status === 'canceled' || o.status === 'cancelled') { statusText = "تم إلغاء هذا الطلب ❌"; statusColor = "#888"; }

    // --- تعديل الوقت: إضافة 3 ساعات لتوقيت البحرين المحلي بدقة ---
    let orderTimeText = "غير متوفر";
    if (o.timestamp) {
        const date = new Date(o.timestamp);
        const bhDate = new Date(date.getTime() + (3 * 3600000)); 
        
        orderTimeText = bhDate.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    // --- حساب المبالغ المالية الجديدة ---
    let deliveryPrice = parseFloat(o.price || 0); // رسوم التوصيل
    let productPrice = parseFloat(o.collectionAmount || 0); // سعر المنتج (المطلوب تحصيله)
    let totalToPay = deliveryPrice + productPrice; // الإجمالي النهائي

    let cancelBtn = (o.status === 'waiting' || o.status === 'accepted') ? 
        `<button class="btn-red" onclick="cancelOrderNow('${o.key}')" style="width:100%; padding:20px; margin-top:15px; background:#DA291C; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">إلغاء الطلب 🗑️</button>` : "";
    
    let dName = o.driverName || "سائق توصيل";
    let dPhone = o.driverPhone || o.driver || ""; 

    let driverHtml = "";
    if (dPhone && (o.status !== 'canceled' && o.status !== 'cancelled')) {
        driverHtml = `
        <div class="info-card-huge" style="border-right: 5px solid #005EB8; background:#e3f2fd; padding:15px; border-radius:12px; margin-bottom:15px;">
            <b style="color:#005EB8; font-size:18px;">بيانات المندوب المسؤول:</b>
            <p style="font-size:20px; margin:10px 0; font-weight:bold;">${dName}</p>
            <p style="font-size:18px; color:#333; margin-bottom:15px;">📞 هاتف المندوب: <b>${dPhone}</b></p>
            <a href="tel:${dPhone}" style="display:block; text-align:center; padding:15px; background:#27ae60; color:white; border-radius:10px; text-decoration:none; font-weight:bold; font-size:18px;">اتصال مباشر بالمندوب 📞</a>
        </div>`;
    }

    let benefitImageHtml = "";
    if (o.method === 'Benefit' && o.proofImage) {
        benefitImageHtml = `
        <div class="info-card-huge" style="padding:15px; border-radius:12px; margin-bottom:15px; border-right:5px solid #005EB8; background:#f0f7ff; text-align:center;">
            <b style="color:#005EB8; font-size:16px; display:block; margin-bottom:10px;">🖼️ صورة إثبات الدفع (بنفت):</b>
            <img src="${o.proofImage}" style="width:100%; border-radius:10px; border:1px solid #ddd; box-shadow: 0 2px 5px rgba(0,0,0,0.1);" onclick="window.open(this.src)">
            <small style="display:block; margin-top:5px; color:#666;">إضغط على الصورة لتكبيرها</small>
        </div>`;
    }

    let detailsArea = document.getElementById('details-render-area');
    if(detailsArea) {
        detailsArea.style.maxHeight = "75vh"; 
        detailsArea.style.overflowY = "auto";
        detailsArea.style.paddingRight = "5px";

        detailsArea.innerHTML = `
            <div class="info-card-huge" style="padding:15px; background:#f9f9f9; border-radius:12px; margin-bottom:15px; border-right:5px solid #333;">
                <b>رقم الطلب المرجعي:</b>
                <p style="word-break:break-all; margin:5px 0; font-family:monospace;">${o.key}</p>
                <p style="margin:5px 0; font-size:14px; color:#555;"><b>تاريخ ووقت الطلب:</b> <span style="font-weight:bold; color:var(--red);">${orderTimeText}</span></p>
                <small><b>طريقة الدفع:</b> ${o.method === 'Benefit' ? 'بنفت 💳' : 'كاش 💵'}</small>
            </div>

            ${benefitImageHtml}
            <div class="info-card-huge" style="padding:15px; border-radius:12px; margin-bottom:15px; border-right:5px solid var(--red); background:#fff9f9;">
                <b style="color:var(--red); font-size:18px;">📍 تفاصيل موقع الاستلام:</b>
                <p style="margin:8px 0;"><b>المنطقة:</b> ${o.pArea}</p>
                <p style="margin:5px 0;"><b>مجمع:</b> ${o.pBlock || '-'} | <b>طريق:</b> ${o.pRoad || '-'} | <b>منزل:</b> ${o.pHouse || '-'}</p>
                ${o.pType ? `<p style="margin:5px 0;"><b>شقة/طابق:</b> ${o.pType}</p>` : ''}
                <p style="margin:5px 0;">📞 هاتف المحل: ${o.pPhone}</p>
                ${o.pLink ? `<a href="${o.pLink}" target="_blank" style="color:#005EB8; display:block; margin-top:5px; font-weight:bold;">🔗 فتح رابط الموقع (GPS)</a>` : ''}
            </div>

            <div class="info-card-huge" style="padding:15px; border-radius:12px; margin-bottom:15px; border-right:5px solid var(--success); background:#f9fff9;">
                <b style="color:var(--success); font-size:18px;">🏁 تفاصيل موقع التسليم:</b>
                <p style="margin:8px 0;"><b>المنطقة:</b> ${o.dArea}</p>
                <p style="margin:5px 0;"><b>مجمع:</b> ${o.dBlock || '-'} | <b>طريق:</b> ${o.dRoad || '-'} | <b>منزل:</b> ${o.dHouse || '-'}</p>
                ${o.dType ? `<p style="margin:5px 0;"><b>شقة/طابق:</b> ${o.dType}</p>` : ''}
                <p style="margin:5px 0;">📞 هاتف التسليم: ${o.dPhone}</p>
                ${o.dLink ? `<a href="${o.dLink}" target="_blank" style="color:#27ae60; display:block; margin-top:5px; font-weight:bold;">🔗 فتح رابط الموقع (GPS)</a>` : ''}
            </div>

            <div style="background:#fff5f5; border-radius:20px; border:2px dashed var(--red); padding:20px; margin-bottom:20px; text-align:center;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:16px; color:#555;">
                    <span>سعر المنتج (تحصيل):</span>
                    <b>${productPrice.toFixed(3)} د.ب</b>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:16px; color:#555;">
                    <span>رسوم التوصيل:</span>
                    <b>${deliveryPrice.toFixed(3)} د.ب</b>
                </div>
                <hr style="border:0; border-top:1px solid #ffcccc; margin:10px 0;">
                <span style="font-size:14px; color:#888;">المبلغ الإجمالي المطلوب من الزبون</span><br>
                <b style="font-size:32px; color:var(--red);">${totalToPay.toFixed(3)} د.ب</b>
            </div>

            <div class="info-card-huge" style="padding:15px; background:#eee; border-radius:12px; margin-bottom:15px; text-align:center;">
                <b>حالة الطلب:</b>
                <p style="font-size:22px; font-weight:bold; color:${statusColor}; margin:5px 0;">${statusText}</p>
            </div>

            ${driverHtml}
            ${cancelBtn}
            <div style="height:20px;"></div> `;
    }
    
    document.getElementById('full-details-overlay').style.display = 'block';
}

// --- الدالة المعدلة للإلغاء لضمان مسح المندوب وتوحيد الحالة ---
function cancelOrderNow(key) {
    if(confirm("هل أنت متأكد من إلغاء الطلب؟")) {
        db.ref('orders/' + key).update({ 
            status: 'cancelled', // تغييرها لـ 2 L لتوافق كود المندوب
            driver: null,        // مسح المندوب لكي يختفي الطلب من شاشته فوراً
            driverPhone: null,
            driverName: null,
            canceledBy: 'user' 
        })
        .then(() => { 
            alert("تم إلغاء الطلب بنجاح"); 
            closeDetails(); 
        })
        .catch(() => { 
            alert("عذراً، حدث خطأ أثناء الإلغاء"); 
        });
    }
}

function closeDetails() {
    document.getElementById('full-details-overlay').style.display = 'none';
}