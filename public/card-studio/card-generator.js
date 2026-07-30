let currentType = 'debt';
        const studioConfig = window.CARD_STUDIO_CONFIG || {};
        const sections = studioConfig.sections || [];
        const layoutStorageKey = 'ABDO_CARD_STUDIO_LAYOUTS_V1';
        const fontStorageKey = 'ABDO_CARD_STUDIO_FONT_V1';
        const cardFontFamilies = Object.freeze({
            cairo: "'Card Cairo', Arial, sans-serif",
            tajawal: "'Card Tajawal', Arial, sans-serif",
            almarai: "'Card Almarai', Arial, sans-serif",
            'noto-kufi': "'Card Noto Kufi Arabic', Arial, sans-serif",
            'ibm-plex': "'Card IBM Plex Sans Arabic', Arial, sans-serif",
        });
        const cardWidths = {
            masraweya: 1050,
            final_statement: 1050,
            purchases: 1020,
            vip: 960,
            alert: 900,
            mini_card: 600,
            zero: 820,
        };

        function getCardWidth(type = currentType) {
            if (type === 'exchange_rate') return 800;
            return cardWidths[type] || 900;
        }

        function readSavedLayouts() {
            try {
                return JSON.parse(localStorage.getItem(layoutStorageKey) || '{}');
            } catch {
                return {};
            }
        }

        function loadSavedLayout() {
            const select = document.getElementById('layoutSelect');
            if (!select) return;
            const saved = readSavedLayouts();
            select.value = saved[currentType] || 'layout-banking';
        }

        function handleLayoutChange() {
            const select = document.getElementById('layoutSelect');
            if (!select) return;
            const saved = readSavedLayouts();
            saved[currentType] = select.value;
            try {
                localStorage.setItem(layoutStorageKey, JSON.stringify(saved));
            } catch {}
            updateCard();
        }

        function readSavedFontFamily() {
            try {
                const savedFont = localStorage.getItem(fontStorageKey);
                return cardFontFamilies[savedFont] ? savedFont : 'cairo';
            } catch {
                return 'cairo';
            }
        }

        function applySelectedFont() {
            const select = document.getElementById('fontFamilySelect');
            const fontKey = select && cardFontFamilies[select.value] ? select.value : readSavedFontFamily();
            const fontFamily = cardFontFamilies[fontKey] || cardFontFamilies.cairo;
            const card = document.getElementById('goldenCard');
            const exchangeCard = document.getElementById('exchangeCard');
            if (card) card.style.setProperty('--card-font', fontFamily);
            if (exchangeCard) exchangeCard.style.setProperty('--card-font', fontFamily);
        }

        function loadSavedFontFamily() {
            const select = document.getElementById('fontFamilySelect');
            if (select) select.value = readSavedFontFamily();
            applySelectedFont();
        }

        function handleFontFamilyChange() {
            const select = document.getElementById('fontFamilySelect');
            if (!select || !cardFontFamilies[select.value]) return;
            try {
                localStorage.setItem(fontStorageKey, select.value);
            } catch {}
            applySelectedFont();
            setTimeout(resizePreview, 50);
        }

        function initDashboard() {
            generateDate();
            renderTiles();
            applyIncomingParams();
            loadSavedFontFamily();
            updateCard();
            setTimeout(resizePreview, 100);
        }

        function resizePreview() {
            const wrapper = document.getElementById('preview-wrapper');
            const container = document.getElementById('preview-container');
            const isExchange = currentType === 'exchange_rate';
            const card = isExchange ? document.getElementById('exchangeCard') : document.getElementById('goldenCard');
            if (!wrapper || !container || !card) return;
            
            const containerWidth = container.clientWidth - 32;
            const cardWidth = card.offsetWidth || getCardWidth();
            
            if (containerWidth < cardWidth) {
                const scale = containerWidth / cardWidth;
                wrapper.style.transform = `scale(${scale})`;
                const cardHeight = card.offsetHeight;
                const heightDiff = cardHeight * (1 - scale);
                wrapper.style.marginBottom = `-${heightDiff}px`;
            } else {
                wrapper.style.transform = 'none';
                wrapper.style.marginBottom = '0px';
            }
        }
        window.addEventListener('resize', resizePreview);

        function setStudioCurrency(value) {
            if (!value) return;
            const idx = currArray.indexOf(value);
            if (idx >= 0) currIndex = idx;
            const currLabel = document.getElementById('currency-label');
            if (currLabel) currLabel.innerText = value;
            document.querySelectorAll('.p-currency').forEach(el => {
                if (el.parentElement.parentElement.classList.contains('row-5')) return;
                el.innerText = value;
            });
        }

        function readIncomingPayload() {
            const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const payloadId = hash.get('payload');
            if (payloadId) {
                const key = `${studioConfig.payloadPrefix || 'ABDO_SMART_CARD_PAYLOAD_'}${payloadId}`;
                const raw = sessionStorage.getItem(key);
                sessionStorage.removeItem(key);
                history.replaceState(null, '', '/card-generator.html');
                try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
            }

            // One-release compatibility for old bookmarked links. Sensitive
            // query data is removed from the address bar immediately.
            const legacy = Object.fromEntries(new URLSearchParams(window.location.search));
            if (Object.keys(legacy).length) {
                history.replaceState(null, '', '/card-generator.html');
            }
            return legacy;
        }

        function applyIncomingParams() {
            const incoming = readIncomingPayload();
            if (!Object.keys(incoming).length) {
                loadSavedLayout();
                return;
            }
            const getValue = (key) => incoming[key] === undefined || incoming[key] === null
                ? null
                : String(incoming[key]);

            let type = getValue('type') || '';
            if (type === 'total_purchasing') type = 'purchases';
            const validTypes = sections.map(s => s.id);
            if (type === 'vip') {
                currentType = 'vip';
                renderTiles();
            } else if (type && validTypes.includes(type)) {
                currentType = type;
                renderTiles();
            }

            const setVal = (id, key) => {
                const v = getValue(key);
                const el = document.getElementById(id);
                if (v !== null && el) el.value = v;
            };

            setVal('nameInput', 'name');
            setVal('customNote', 'note');
            setVal('themeSelect', 'theme');
            const incomingLayout = getValue('layout');
            if (incomingLayout) setVal('layoutSelect', 'layout');
            else loadSavedLayout();

            if (currentType === 'masraweya') {
                setVal('input-prev', 'prev');
                setVal('input-recv', 'recv');
                setVal('input-total', 'total');
                setVal('input-remain', 'remain');
                const incomingDate = getValue('date') || getValue('day');
                if (incomingDate) {
                    document.getElementById('stmt-date-display').innerText = incomingDate;
                    document.getElementById('card-date-display').innerText = "التاريخ: " + incomingDate;
                }
            } else if (currentType === 'purchases') {
                setVal('purchasesMerchantType', 'merchant');
                document.getElementById('p-in-1').value = getValue('p1') ?? getValue('prev') ?? '0';
                document.getElementById('p-in-2').value = getValue('p2') ?? getValue('work') ?? '0';
                document.getElementById('p-in-3').value = getValue('p3') ?? getValue('paid') ?? '0';
                document.getElementById('p-in-4').value = getValue('p4') ?? getValue('debt') ?? '0';
                document.getElementById('p-in-5').value = getValue('p5') ?? getValue('egp') ?? '0';
            } else {
                if (currentType === 'companies') setVal('companyOrMerchant', 'acctype');
                setVal('amountInput', 'amount');
                setVal('priceInput', 'price');
            }

            setStudioCurrency(getValue('currency'));
        }

        function renderTiles() {
            const container = document.getElementById('tiles-container');
            container.innerHTML = '';
            sections.forEach(sec => {
                const btn = document.createElement('button');
                btn.className = `px-4 py-1.5 text-sm rounded-xl transition-all duration-300 font-bold whitespace-nowrap ${
                    currentType === sec.id 
                    ? 'bg-green-700 text-white shadow-md border-2 border-green-400' 
                    : 'bg-green-500 text-white border border-green-600 hover:bg-green-600 shadow-sm'
                }`;
                btn.innerText = sec.label;
                btn.onclick = () => {
                    currentType = sec.id;
                    renderTiles();
                    loadSavedLayout();
                    document.getElementById('tafqeet-display').classList.add('hidden-element');
                    if (sec.id === 'vip') {
                        document.getElementById('themeSelect').value = 'bg-vip';
                    }
                    updateCard();
                };
                container.appendChild(btn);
            });
        }

        function generateDate() {
            let now = new Date();
            currentFormattedDate = `${now.getFullYear()}-${("0" + (now.getMonth() + 1)).slice(-2)}-${("0" + now.getDate()).slice(-2)}`;
            document.getElementById('stmt-date-display').innerText = currentFormattedDate;
            document.getElementById('card-date-display').innerText = "التاريخ: " + currentFormattedDate;
            document.getElementById('purchases-date-display').innerText = currentFormattedDate;
        }

        let currArray = ["د.ل", "ج.م", "EGP"];
        let currIndex = 0;

        function generateTafqeet() {
            let val = document.getElementById('amountInput').value.replace(/,/g, '');
            let num = parseInt(val);
            let display = document.getElementById('tafqeet-display');
            
            if(isNaN(num) || num === 0) {
                display.innerText = '';
                display.classList.add('hidden-element');
                return;
            }

            const a1 = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
            const a2 = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
            const a = a1.concat(a2);
            const b = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
            const c = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

            function convertGroups(n) {
                let res = "";
                let h = Math.floor(n / 100);
                let rem = n % 100;
                if (h > 0) res += c[h];
                if (rem > 0) {
                    if (res !== "") res += " و ";
                    if (rem < 20) res += a[rem];
                    else {
                        let tens = Math.floor(rem / 10);
                        let ones = rem % 10;
                        if (ones > 0) res += a[ones] + " و " + b[tens];
                        else res += b[tens];
                    }
                }
                return res;
            }

            let result = "";
            let millions = Math.floor(num / 1000000);
            let thousands = Math.floor((num % 1000000) / 1000);
            let units = num % 1000;

            if (millions > 0) {
                if (millions === 1) result += "مليون";
                else if (millions === 2) result += "مليونان";
                else if (millions >= 3 && millions <= 10) result += convertGroups(millions) + " ملايين";
                else result += convertGroups(millions) + " مليون";
            }
            if (thousands > 0) {
                if (result !== "") result += " و ";
                if (thousands === 1) result += "ألف";
                else if (thousands === 2) result += "ألفان";
                else if (thousands >= 3 && thousands <= 10) result += convertGroups(thousands) + " آلاف";
                else result += convertGroups(thousands) + " ألف";
            }
            if (units > 0) {
                if (result !== "") result += " و ";
                result += convertGroups(units);
            }

            let curr = document.getElementById('currency-label').innerText;
            let currencyName = (curr === 'د.ل') ? 'دينار ليبي' : (curr === 'ج.م' || curr === 'EGP') ? 'جنيه مصري' : '';

            display.innerText = "فقط " + result + " " + currencyName + " لا غير.";
            display.classList.remove('hidden-element');
        }

        let zoomLevel = 0;
        function changeFontSize(action) {
            if (action === 'increase') zoomLevel = Math.min(6, zoomLevel + 1);
            else if (action === 'decrease') zoomLevel = Math.max(-6, zoomLevel - 1);
            else if (action === 'reset') zoomLevel = 0;

            const isMini = document.getElementById('goldenCard').classList.contains('mini-card-layout');
            const isMiniCentered = document.getElementById('goldenCard').classList.contains('mini-card-centered');
            const isExchange = currentType === 'exchange_rate';
            const isOfficialLayout = document.getElementById('layoutSelect')?.value === 'layout-official';
            
            if (isExchange) {
                const exchangeTitleSize = isOfficialLayout ? 38 : 44;
                const exchangePriceSize = isOfficialLayout ? 138 : 160;
                const exchangeNoteSize = isOfficialLayout ? 23 : 28;
                document.getElementById('exchangeCard').querySelector('.card-line-1').style.fontSize = (exchangeTitleSize + (zoomLevel * 3)) + 'px';
                document.getElementById('exchangeCard').querySelector('.card-line-2').style.fontSize = (exchangeTitleSize + (zoomLevel * 3)) + 'px';
                document.getElementById('exchangePriceDisplay').style.fontSize = (exchangePriceSize + (zoomLevel * 10)) + 'px';
                document.getElementById('exchangeCard').querySelector('.card-footer-note').style.fontSize = (exchangeNoteSize + (zoomLevel * 2)) + 'px';
            } 
            else if (isMini) {
                if (isMiniCentered) {
                    document.getElementById('card-header').style.fontSize = (55 + (zoomLevel * 5)) + 'pt';
                    document.getElementById('display-name').style.fontSize = '';
                    document.getElementById('status-label').style.fontSize = '';
                    let amountTextDiv = document.getElementById('amount-container');
                    if(amountTextDiv) amountTextDiv.style.fontSize = '';
                    let currencySpan = document.getElementById('currency-label');
                    if(currencySpan) currencySpan.style.fontSize = '';
                    document.getElementById('custom-note-box').style.fontSize = '';
                } else {
                    document.getElementById('card-header').style.fontSize = (24 + (zoomLevel * 2)) + 'pt';
                    document.getElementById('display-name').style.fontSize = (32 + (zoomLevel * 3)) + 'pt';
                    document.getElementById('status-label').style.fontSize = (16 + (zoomLevel * 1)) + 'pt';
                    let amountTextDiv = document.getElementById('amount-container');
                    if(amountTextDiv) amountTextDiv.style.fontSize = (48 + (zoomLevel * 4)) + 'pt';
                    let currencySpan = document.getElementById('currency-label');
                    if(currencySpan) currencySpan.style.fontSize = (18 + (zoomLevel * 2)) + 'pt';
                    document.getElementById('custom-note-box').style.fontSize = (14 + (zoomLevel * 1)) + 'pt';
                }
            } else {
                document.getElementById('card-header').style.fontSize = '';
                document.getElementById('custom-note-box').style.fontSize = '';
                document.getElementById('display-name').style.fontSize = (50 + (zoomLevel * 4)) + 'pt';
                document.getElementById('status-label').style.fontSize = (22 + (zoomLevel * 2)) + 'pt';
                let amountTextDiv = document.getElementById('amount-container');
                if(amountTextDiv) amountTextDiv.style.fontSize = (100 + (zoomLevel * 6)) + 'pt';
                let currencySpan = document.getElementById('currency-label');
                if(currencySpan) currencySpan.style.fontSize = (32 + (zoomLevel * 2)) + 'pt';
            }

            document.querySelectorAll('.stmt-label').forEach(el => el.style.fontSize = (22 + (zoomLevel * 2)) + 'pt');
            document.querySelectorAll('.stmt-value').forEach(el => el.style.fontSize = (30 + (zoomLevel * 3)) + 'pt');
            document.querySelectorAll('.final-row .stmt-label, .final-row .stmt-value').forEach(el => el.style.fontSize = (36 + (zoomLevel * 3)) + 'pt');
            document.getElementById('stmt-header-title').style.fontSize = (32 + (zoomLevel * 3)) + 'pt';

            document.querySelectorAll('.p-label').forEach(el => el.style.fontSize = (24 + (zoomLevel * 2)) + 'pt');
            document.querySelectorAll('.p-value').forEach(el => el.style.fontSize = (36 + (zoomLevel * 3)) + 'pt');
            document.querySelectorAll('.p-currency').forEach(el => el.style.fontSize = (16 + (zoomLevel * 2)) + 'pt');
            document.getElementById('purchases-top-bar').style.fontSize = (20 + (zoomLevel * 2)) + 'pt';
            
            let tafqeetDisplay = document.getElementById('tafqeet-display');
            if(tafqeetDisplay) tafqeetDisplay.style.fontSize = (22 + (zoomLevel * 2)) + 'pt';
        }

        function loadTemplate() {
            let val = document.getElementById('templateSelect').value;
            let noteBox = document.getElementById('customNote');
            
            if (val === 'matabaqa') noteBox.value = "تمت مطابقة الكشف مع حساباتنا، والرصيد النهائي المعتمد هو الموضح أعلاه. يرجى المراجعة والاعتماد من طرفكم.";
            else if (val === 'fix_rate') noteBox.value = "تم تنفيذ التحويل وإقفال المعاملة بناءً على سعر الصرف المتفق عليه اليوم. ولا نقبل أي تعديل أو مراجعة للسعر بعد التنفيذ.";
            else if (val === 'deduct_trust') noteBox.value = "تم خصم المبلغ الموضح من رصيد الأمانات الخاص بكم بناءً على طلبكم. رصيدكم المتبقي لدينا محدث في الكشف.";
            else if (val === 'hold_transfer') noteBox.value = "تم استلام المبلغ، ولكن تم تعليق تنفيذ الحوالة لحين استكمال بيانات المستفيد (الاسم الرباعي ورقم الهاتف). يرجى التواصل لتأكيد البيانات.";
            else if (val === 'cover_alert') noteBox.value = "نرجو التكرم بمراجعة الكشف وتغطية الرصيد المكشوف في أقرب فرصة، لضمان استمرار سرعة تنفيذ معاملاتكم القادمة.";
            else if (val === 'received_abroad') noteBox.value = "تم تأكيد استلام الحوالة من طرفنا، وجاري تنفيذ المعاملة وتسليمها للمستفيد النهائي في أسرع وقت.";
            else if (val === 'houta') noteBox.value = "يرجى التوجه إلى مكتب «الحوتة» لإيداع القيمة المستحقة عليكم.\nوعند إتمام عملية الإيداع، نرجو إبلاغنا لتأكيد الحساب.";
            else if (val === 'receipt') noteBox.value = "نُعلمكم بأنه قد تم استلام القيمة الموضحة أعلاه بنجاح.\nشاكرين لكم ثقتكم وحسن تعاملكم معنا.";
            else if (val === 'delivery') noteBox.value = "نُعلمكم بأنه قد تم تسليم القيمة الموضحة أعلاه بنجاح.\nيرجى مراجعة الحساب وتأكيد الاستلام من طرفكم.";
            else if (val === 'debt_reminder') noteBox.value = "نود تذكيركم بضرورة تسوية المديونية الموضحة أعلاه في أقرب وقت ممكن.\nنرجو سرعة الاستجابة لتحديث رصيدكم.";
            else if (val === 'trust_deposit') noteBox.value = "تم إيداع القيمة الموضحة كأمانة في حسابكم لدينا بنجاح.\nرصيدكم الآن محدث ومتاح للاستخدام في أي وقت.";
            else if (val === 'clearance_note') noteBox.value = "تم تصفية الحساب وعمل مخالصة مالية نهائية.\nرصيدكم الحالي (صفر) ولا توجد أي التزامات مالية بين الطرفين.";
            else if (val === 'price_drop_alert') noteBox.value = "إشعار انخفاض السعر.\nنلفت انتباهكم إلى أنه سيتم تعديل الأسعار بناءً على المؤشرات الحالية.";
            else if (val === 'price_freeze_dollar') noteBox.value = "الأسعار تشهد حالياً ارتفاعاً مستمراً في الدولار.\nلذا سنتوقف عن إعلان أسعار جديدة مؤقتاً لحين استقرار السوق.";
            else if (val === 'network_delay_alert') noteBox.value = "تنبيه هام: توجد حالياً مشكلة في التغطية أو شبكة الاتصالات.\nنرجو الانتباه إلى أن الحوالات قد تتأخر عن موعدها المعتاد بسبب انقطاع الشبكة من المصدر.";
            else noteBox.value = ""; 
            
            updateCard();
        }

        function formatInteger(numStr) {
            if (!numStr) return "0";
            let clean = String(numStr).replace(/,/g, '').replace(/-/g, '').trim();
            if (clean === "") return "0";
            let integerPart = parseInt(clean.split('.')[0], 10);
            if (isNaN(integerPart)) return "0";
            return integerPart.toLocaleString('en-US'); 
        }

        function formatSignedInteger(numStr) {
            if (!numStr) return "0";
            const clean = String(numStr).replace(/,/g, '').trim();
            const parsed = Number(clean);
            if (!Number.isFinite(parsed)) return "0";
            return Math.trunc(parsed).toLocaleString('en-US');
        }

        function formatDecimal(numStr) {
            if (!numStr) return "0";
            let clean = String(numStr).replace(/,/g, '').replace(/-/g, '').trim();
            if (clean === "") return "0";
            let parts = clean.split('.');
            let integerPart = parseInt(parts[0], 10);
            if (isNaN(integerPart)) return clean;
            let formattedInt = integerPart.toLocaleString('en-US');
            if (parts.length > 1) return formattedInt + '.' + parts[1];
            return formattedInt;
        }

        function handleThemeChange() {
            const theme = document.getElementById('themeSelect').value;
            const recommendedColors = {
                'bg-navy': '#ffffff',
                'bg-dark': '#f1c40f',
                'bg-emerald': '#ffffff',
                'bg-ruby': '#ffffff',
                'bg-ocean': '#ffffff',
                'bg-copper': '#ffffff',
                'bg-purple': '#ffffff',
                'bg-vip': '#f5d76e',
                'bg-pyramids-3d': '#fff4c2',
                'bg-libya-heritage-3d': '#fff5d6',
                'bg-nature-light': '#173d2b',
                'bg-custom-image': '#ffffff',
                'bg-gold': '#110c00',
                'bg-silver': '#1a1a1a',
                'bg-pearl': '#1a1a1a',
            };
            const picker = document.getElementById('titleColorPicker');
            if (picker && recommendedColors[theme]) picker.value = recommendedColors[theme];
            updateCard();
        }

        function updateCard() {
            let themeValue = document.getElementById('themeSelect').value;
            let layoutValue = document.getElementById('layoutSelect').value;
            let cardContainer = document.getElementById('goldenCard');
            let exchangeContainer = document.getElementById('exchangeCard');
            window.CardStudioAI?.clearCustomBackgroundIfNeeded(themeValue);
            cardContainer.className = "card " + themeValue + " " + layoutValue;
            cardContainer.style.setProperty('--card-width', getCardWidth() + 'px');
            exchangeContainer.className = "system-gold-card " + themeValue + " " + layoutValue;
            applySelectedFont();
            if (currentType === 'masraweya' || currentType === 'final_statement') {
                cardContainer.classList.add('masraweya-card');
            } else if (currentType === 'purchases') {
                cardContainer.classList.add('purchases-card');
            }

            let titleColor = document.getElementById('titleColorPicker').value;
            document.getElementById('card-header').style.color = titleColor;
            document.getElementById('display-name').style.color = titleColor;
            document.getElementById('stmt-header-title').style.color = titleColor;
            document.getElementById('purchases-top-bar').style.color = titleColor;
            exchangeContainer.querySelectorAll('.card-text-layer').forEach((element) => {
                element.style.color = titleColor;
            });

            let nameValue = document.getElementById('nameInput').value || '...';
            let rawAmount = document.getElementById('amountInput').value || '0';
            let priceValue = document.getElementById('priceInput').value.trim(); 
            let customNoteText = document.getElementById('customNote').value.trim();
            let showCompany = document.getElementById('companyToggle').checked;
            let showDate = document.getElementById('dateToggle').checked;

            let formattedAmountInteger = formatInteger(rawAmount);
            let formattedAmountDecimal = formatDecimal(rawAmount);

            let customNoteBox = document.getElementById('custom-note-box');
            customNoteBox.classList.remove('large-note'); 
            
            if (customNoteText !== "") { customNoteBox.innerText = customNoteText; customNoteBox.classList.remove('hidden-element'); } 
            else { customNoteBox.classList.add('hidden-element'); }

            let priceBadge = document.getElementById('price-badge');
            let displayPrice = document.getElementById('display-price');
            if (priceValue !== "") { displayPrice.innerText = priceValue; priceBadge.classList.remove('hidden-element'); }
            else { priceBadge.classList.add('hidden-element'); }

            let footer = document.getElementById('card-footer');
            let spacer = document.getElementById('card-spacer');
            if (showCompany) { footer.classList.remove('hidden-element'); spacer.classList.remove('hidden-element'); } 
            else { footer.classList.add('hidden-element'); spacer.classList.add('hidden-element'); }

            let dateDisplay = document.getElementById('card-date-display');
            if (showDate) { dateDisplay.classList.remove('hidden-element'); } 
            else { dateDisplay.classList.add('hidden-element'); }

            document.getElementById('card-header').classList.add('hidden-element');
            document.getElementById('display-name').classList.add('hidden-element');
            document.getElementById('amount-box-container').classList.add('hidden-element');
            document.getElementById('status-label').classList.add('hidden-element');
            document.getElementById('final-statement-box').classList.add('hidden-element');
            document.getElementById('purchases-box').classList.add('hidden-element');
            document.getElementById('price-card-title').classList.add('hidden-element');
            document.getElementById('exchange-note').classList.add('hidden-element');
            
            document.getElementById('statement-inputs-group').classList.add('hidden-element');
            document.getElementById('purchases-inputs-group').classList.add('hidden-element');
            document.getElementById('vip-inputs-group').classList.add('hidden-element');
            document.getElementById('main-amount-group').classList.add('hidden-element');
            document.getElementById('secondary-price-group').classList.add('hidden-element');
            document.getElementById('companies-inputs-group').classList.add('hidden-element'); 
            document.getElementById('mini-card-inputs-group').classList.add('hidden-element');
            cardContainer.classList.remove('mini-card-layout');

            // --- التحكم في إظهار وإخفاء الكارت الجديد ---
            if (currentType === 'exchange_rate') {
                document.getElementById('goldenCard').classList.add('hidden-element');
                exchangeContainer.classList.remove('hidden-element');
            } else {
                document.getElementById('goldenCard').classList.remove('hidden-element');
                exchangeContainer.classList.add('hidden-element');
            }

            if (currentType === 'masraweya' || currentType === 'final_statement') {
                document.getElementById('final-statement-box').classList.remove('hidden-element');
                document.getElementById('statement-inputs-group').classList.remove('hidden-element');
                document.getElementById('name-input-label').innerText = "عنوان الكشف / التاجر:";
                document.getElementById('stmt-header-title').innerText = currentType === 'masraweya' ? 'التقرير النهائى' : (nameValue !== '...' ? nameValue : 'الكشف النهائي');
                document.getElementById('stmt-date-display').innerText = 'التاريخ: ' + currentFormattedDate;
                document.getElementById('val-previous').innerText = formatSignedInteger(document.getElementById('input-prev').value);
                document.getElementById('val-received').innerText = formatSignedInteger(document.getElementById('input-recv').value);
                document.getElementById('val-total').innerText = formatSignedInteger(document.getElementById('input-total').value);
                document.getElementById('val-remaining').innerText = formatSignedInteger(document.getElementById('input-remain').value);
            }
            else if (currentType === 'purchases') {
                document.getElementById('purchases-box').classList.remove('hidden-element');
                document.getElementById('purchases-inputs-group').classList.remove('hidden-element');
                document.getElementById('name-input-label').innerText = "اسم التاجر:";
                
                let merchantType = document.getElementById('purchasesMerchantType').value;
                document.getElementById('purchases-merchant-name').innerText = nameValue !== '...' ? (nameValue + " - " + merchantType) : ("التاجر " + merchantType);
                
                document.getElementById('p-val-1').innerText = formatSignedInteger(document.getElementById('p-in-1').value);
                document.getElementById('p-val-2').innerText = formatSignedInteger(document.getElementById('p-in-2').value);
                document.getElementById('p-val-3').innerText = formatSignedInteger(document.getElementById('p-in-3').value);
                document.getElementById('p-val-4').innerText = formatSignedInteger(document.getElementById('p-in-4').value);
                document.getElementById('p-val-5').innerText = formatSignedInteger(document.getElementById('p-in-5').value);
            }
            else if (currentType === 'alert') {
                document.getElementById('card-header').innerText = "❖ إشعار تنبيه ❖";
                document.getElementById('display-name').innerText = nameValue;
                document.getElementById('card-header').classList.remove('hidden-element');
                document.getElementById('display-name').classList.remove('hidden-element');
                priceBadge.classList.add('hidden-element');
                customNoteBox.classList.add('large-note');
            }
            else if (currentType === 'mini_card') {
                document.getElementById('mini-card-inputs-group').classList.remove('hidden-element');
                cardContainer.classList.add('mini-card-layout');
                
                let mType = document.getElementById('miniCardType').value;
                let mCustom = document.getElementById('miniCardCustomHeader').value;
                let mName = document.getElementById('miniCardName').value.trim();
                let mValue = document.getElementById('miniCardValue').value || '0';
                let mNote = document.getElementById('miniCardNote').value.trim();

                if (mType === 'custom') {
                    document.getElementById('miniCardCustomHeaderWrapper').classList.remove('hidden-element');
                    document.getElementById('card-header').innerText = mCustom || 'عنوان الكارت';
                } else {
                    document.getElementById('miniCardCustomHeaderWrapper').classList.add('hidden-element');
                    document.getElementById('card-header').innerText = mType;
                }

                document.getElementById('card-header').classList.remove('hidden-element');
                
                if (mName !== '') {
                    document.getElementById('display-name').innerText = mName;
                    document.getElementById('display-name').classList.remove('hidden-element');
                } else {
                    document.getElementById('display-name').classList.add('hidden-element');
                }

                if (mValue !== '' && mValue !== '0') {
                    document.getElementById('status-label').innerText = "القيمة:";
                    document.getElementById('status-label').classList.remove('hidden-element');
                    document.getElementById('display-amount').innerText = formatDecimal(mValue);
                    document.getElementById('amount-box-container').classList.remove('hidden-element');
                    document.getElementById('main-amount-group').classList.remove('hidden-element');
                } else {
                    document.getElementById('status-label').classList.add('hidden-element');
                    document.getElementById('amount-box-container').classList.add('hidden-element');
                    document.getElementById('main-amount-group').classList.add('hidden-element');
                }

                if (mNote !== '') {
                    customNoteBox.innerText = mNote;
                    customNoteBox.classList.remove('hidden-element');
                } else {
                    customNoteBox.classList.add('hidden-element');
                }

                if (mName === '' && (mValue === '' || mValue === '0') && mNote === '') {
                    cardContainer.classList.add('mini-card-centered');
                } else {
                    cardContainer.classList.remove('mini-card-centered');
                }
            }
            else if (currentType === 'exchange_rate') {
                // تفعيل خيارات الكارت الجديد لأسعار الصرف
                document.getElementById('main-amount-group').classList.remove('hidden-element');
                document.getElementById('amount-input-label').innerText = 'السعر (يقبل الكسور):';
                
                // تحديث السعر
                document.getElementById('exchangePriceDisplay').innerText = formattedAmountDecimal;
                
                // تحديث ألوان العناوين
                exchangeContainer.querySelectorAll('.card-text-layer').forEach((element) => {
                    element.style.color = titleColor;
                });
            } 
            else {
                document.getElementById('card-header').classList.remove('hidden-element');
                document.getElementById('display-name').classList.remove('hidden-element');
                document.getElementById('status-label').classList.remove('hidden-element');
                document.getElementById('amount-box-container').classList.remove('hidden-element');
                document.getElementById('main-amount-group').classList.remove('hidden-element');
                document.getElementById('secondary-price-group').classList.remove('hidden-element');
                
                document.getElementById('display-name').innerText = nameValue;
                document.getElementById('display-amount').innerText = formattedAmountInteger;
                document.getElementById('name-input-label').innerText = "اسم العميل / الشركة:";

                if (currentType === 'debt') {
                    document.getElementById('status-label').innerText = "إجمالي الديون المستحقة عليك:";
                    document.getElementById('card-header').innerText = "❖ إشعار مديونية ❖";
                } 
                else if (currentType === 'zero') {
                    document.getElementById('status-label').innerText = "تم تصفير رصيد الحساب بنجاح";
                    document.getElementById('card-header').innerText = "❖ تصفير حساب ❖";
                    document.getElementById('display-amount').innerText = "0";
                    document.getElementById('amount-input-label').innerText = "القيمة:";
                    document.getElementById('amountInput').value = "0";
                    document.getElementById('secondary-price-group').classList.add('hidden-element');
                    try {
                        const cardEl = document.getElementById('goldenCard');
                        Array.from(cardEl.children).forEach(ch => {
                            const txt = (ch.innerText || '').trim();
                            if (/^[\.\u2022\u25CF\u00B7\*\s]{1,6}$/.test(txt)) {
                                ch.classList.add('hidden-element');
                            }
                        });
                    } catch (e) {}
                    const statusEl = document.getElementById('status-label');
                    statusEl.style.transform = 'translateY(-10px)';
                    statusEl.style.marginBottom = '6px';
                    const amountText = document.getElementById('amount-container');
                    const displayAmount = document.getElementById('display-amount');
                    const currencyLabel = document.getElementById('currency-label');
                    if (amountText) amountText.style.alignItems = 'baseline';
                    if (displayAmount) { displayAmount.style.position = 'relative'; displayAmount.style.top = '-8px'; }
                    if (currencyLabel) currencyLabel.style.alignSelf = 'flex-end';
                }
                else if (currentType === 'vip') {
                    document.getElementById('vip-inputs-group').classList.remove('hidden-element');
                    const showLogo = document.getElementById('vipLogoCheck').checked;
                    if (showLogo) {
                        document.getElementById('status-label').innerText = "✦ عميل مميز ✦";
                        document.getElementById('card-header').innerText = "👑 ❖ VIP ❖ 👑";
                    } else {
                        document.getElementById('status-label').innerText = "الرصيد الحالي:";
                        document.getElementById('card-header').innerText = "❖ عميل مميز ❖";
                    }
                    document.getElementById('name-input-label').innerText = "اسم العميل الـ VIP:";
                    document.getElementById('status-label').style.fontSize = '30pt';
                    document.getElementById('status-label').style.letterSpacing = '6px';
                    document.getElementById('display-amount').style.fontSize = '150pt';
                    document.getElementById('display-amount').style.textShadow = '0 0 30px rgba(212,175,55,0.6)';
                    document.getElementById('secondary-price-group').classList.add('hidden-element');
                }
                else if (currentType === 'companies') {
                    document.getElementById('companies-inputs-group').classList.remove('hidden-element');
                    let accType = document.getElementById('companyOrMerchant').value;
                    let compRawAmount = document.getElementById('amountInput').value || '0';
                    let isNegative = compRawAmount.trim().startsWith('-');
                    if (accType === 'merchant') {
                        document.getElementById('status-label').innerText = isNegative ? "لكم رصيد مستحق لدينا:" : "عليكم ديون مستحقة:";
                        document.getElementById('card-header').innerText = isNegative ? "❖ إشعار رصيد تاجر ❖" : "❖ إشعار مديونية تاجر ❖";
                        document.getElementById('name-input-label').innerText = "اسم التاجر:";
                    } else {
                        document.getElementById('status-label').innerText = isNegative ? "لكم رصيد مستحق لدينا:" : "عليكم ديون مستحقة:";
                        document.getElementById('card-header').innerText = isNegative ? "❖ إشعار رصيد شركة ❖" : "❖ إشعار مديونية شركة ❖";
                        document.getElementById('name-input-label').innerText = "اسم الشركة:";
                    }
                }
                else if (currentType === 'trust') {
                    let trustRawAmount = document.getElementById('amountInput').value || '0';
                    let isNegative = trustRawAmount.trim().startsWith('-');
                    document.getElementById('status-label').innerText = isNegative ? "عليك أمانة:" : "لديك أمانة لدينا:";
                    document.getElementById('card-header').innerText = isNegative ? "❖ إشعار أمانة (مطلوب منك) ❖" : "❖ إشعار أمانة ❖";
                }
                
                document.getElementById('display-amount').style.fontSize = '';
                document.getElementById('currency-label').style.fontSize = '';
                document.getElementById('display-price').style.fontSize = '';
                document.getElementById('card-footer').style.fontSize = '';
                document.getElementById('card-footer').style.fontWeight = '';
                
                const statusLabel = document.getElementById('status-label');
                statusLabel.style.fontSize = '';
                statusLabel.style.letterSpacing = '';
                statusLabel.style.fontWeight = '';
                statusLabel.style.marginTop = '';
                
                const damt = document.getElementById('display-amount');
                damt.style.fontSize = '';
                damt.style.textShadow = '';
                
                document.getElementById('price-card-title').classList.add('hidden-element');
                document.getElementById('currency-label').classList.remove('hidden-element');
                document.getElementById('corner-tl').classList.remove('hidden-element');
                document.getElementById('corner-tr').classList.remove('hidden-element');
                document.getElementById('corner-bl').classList.remove('hidden-element');
                document.getElementById('corner-br').classList.remove('hidden-element');
                document.getElementById('crown-top').classList.remove('hidden-element');
                
                try {
                    const statusEl = document.getElementById('status-label'); if (statusEl) { statusEl.style.transform = ''; statusEl.style.marginBottom = ''; }
                    const amountText = document.getElementById('amount-container'); if (amountText) amountText.style.alignItems = '';
                    const displayAmount = document.getElementById('display-amount'); if (displayAmount) { displayAmount.style.position=''; displayAmount.style.top=''; }
                    const currencyLabel = document.getElementById('currency-label'); if (currencyLabel) currencyLabel.style.alignSelf = '';
                } catch (e) {}
            }
            changeFontSize(null);
            setTimeout(resizePreview, 50);
        }

        async function copyCard(btnElement) {
            const isExchange = currentType === 'exchange_rate';
            const card = isExchange ? document.getElementById('exchangeCard') : document.getElementById('goldenCard');
            const wrapper = document.getElementById('preview-wrapper');
            const originalText = btnElement.innerHTML;
            btnElement.innerHTML = "⚡ جاري النسخ...";
            btnElement.style.pointerEvents = "none";

            const originalWidth = card.style.width;
            const originalMaxWidth = card.style.maxWidth;
            const originalTransform = card.style.transform;
            
            const targetWidth = getCardWidth() + 'px';

            const originalWrapperTransform = wrapper.style.transform;
            const originalWrapperMargin = wrapper.style.marginBottom;
            wrapper.style.transform = 'none';
            wrapper.style.marginBottom = '0px';

            card.style.width = targetWidth;
            card.style.maxWidth = targetWidth;
            card.style.transform = 'none';

            try {
                // First let the selected font reach the rendered card, then
                // wait for its local file before taking the export snapshot.
                await new Promise((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(resolve));
                });
                if (document.fonts?.ready) await document.fonts.ready;

                const exportWidth = card.offsetWidth;
                const exportHeight = card.offsetHeight;
                const canvas = await html2canvas(card, {
                    scale: 5,
                    backgroundColor: null,
                    dir: 'rtl',
                    logging: false,
                    useCORS: true,
                    width: exportWidth,
                    height: exportHeight,
                    windowWidth: Math.max(document.documentElement.clientWidth, exportWidth),
                    windowHeight: Math.max(document.documentElement.clientHeight, exportHeight),
                    onclone: (clonedDocument) => {
                        const clonedCard = clonedDocument.getElementById(card.id);
                        if (!clonedCard) return;
                        clonedCard.style.width = targetWidth;
                        clonedCard.style.maxWidth = targetWidth;
                        clonedCard.style.height = exportHeight + 'px';
                        clonedCard.style.minHeight = exportHeight + 'px';
                        clonedCard.style.transform = 'none';
                    }
                });

                canvas.toBlob(async (blob) => {
                    try {
                        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        const file = new File([blob], "price_card.png", { type: "image/png" });

                        if (isMobileDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({ files: [file], title: 'كارت السعر' });
                            btnElement.innerHTML = "✅ تمت المشاركة بنجاح!";
                        } else if (navigator.clipboard && window.ClipboardItem) {
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                            btnElement.innerHTML = "✅ تم النسخ بنجاح!";
                        } else {
                            downloadCardBlob(blob);
                            btnElement.innerHTML = "✅ تم تنزيل الصورة بنجاح!";
                        }
                        
                        setTimeout(() => { btnElement.innerHTML = originalText; btnElement.style.pointerEvents = "auto"; }, 2000);
                    } catch (err) {
                        downloadCardBlob(blob);
                        btnElement.innerHTML = "✅ تم تنزيل الصورة بدلاً من النسخ";
                        setTimeout(() => {
                            btnElement.innerHTML = originalText;
                            btnElement.style.pointerEvents = "auto";
                        }, 2000);
                    }
                });
            } catch (error) {
                alert("حدث خطأ.");
                btnElement.innerHTML = originalText;
                btnElement.style.pointerEvents = "auto";
            } finally {
                card.style.width = originalWidth;
                card.style.maxWidth = originalMaxWidth;
                card.style.transform = originalTransform;
                wrapper.style.transform = originalWrapperTransform;
                wrapper.style.marginBottom = originalWrapperMargin;
            }
        }

        function downloadCardBlob(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `smart-card-${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
