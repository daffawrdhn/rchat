const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    console.log("Starting Automated Validation Test for XOXO Chat...");
    
    // Launch two browser instances to simulate two users
    const browser1 = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
    const browser2 = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });


    const page1 = await browser1.newPage();
    const page2 = await browser2.newPage();

    await page1.setViewport({ width: 1280, height: 800 });
    await page2.setViewport({ width: 1280, height: 800 });

    page1.on('console', msg => console.log('[Page1 Console]', msg.text()));
    page1.on('pageerror', err => console.log('[Page1 Error]', err));
    page2.on('console', msg => console.log('[Page2 Console]', msg.text()));
    page2.on('pageerror', err => console.log('[Page2 Error]', err));

    const SITE_URL = 'https://chat.1year.site';

    async function login(page, name) {
        console.log(`[${name}] Connecting to site...`);
        await page.goto(SITE_URL, { waitUntil: 'networkidle2' });
        
        // Wait for and click Accept Terms
        await page.waitForSelector('button[onclick="acceptTerms()"]', { visible: true });
        await page.click('button[onclick="acceptTerms()"]');
        
        // Wait for Random Chat view to be visible
        await page.waitForSelector('#random-chat-view:not(.hidden)', { visible: true });
        console.log(`[${name}] Logged in successfully.`);
    }

    try {
        await login(page1, 'User1');
        await login(page2, 'User2');

        // ==========================================
        // TEST 1: PUBLIC LOUNGE
        // ==========================================
        console.log("\n--- Running Test 1: Public Lounge ---");
        
        await page1.click('#nav-public');
        await page2.click('#nav-public');
        
        await page1.waitForSelector('#public-chat-view:not(.hidden)', { visible: true });
        await page2.waitForSelector('#public-chat-view:not(.hidden)', { visible: true });
        
        const testPublicMsg = "Hello Public from Autotest " + Date.now();
        
        // User 1 sends message
        await page1.type('#public-msg-input', testPublicMsg);
        await page1.keyboard.press('Enter');
        console.log(`[User1] Sent public message: ${testPublicMsg}`);

        // User 2 waits to receive
        await page2.waitForFunction(
            (msg) => {
                const boxes = document.querySelectorAll('#public-chat-box .chat-bubble');
                for (let b of boxes) {
                    if (b.innerText.includes(msg)) return true;
                }
                return false;
            },
            { timeout: 5000 },
            testPublicMsg
        );
        console.log(`[User2] Successfully received public message.`);


        // ==========================================
        // TEST 2: CUSTOM ROOM (Encryption test)
        // ==========================================
        console.log("\n--- Running Test 2: Custom Room (Encrypted) ---");
        
        await page1.click('#nav-group');
        await page2.click('#nav-group');
        
        const testRoomId = "testroom_" + Math.floor(Math.random() * 1000);
        
        async function joinRoom(page, name, roomId) {
            await page.waitForSelector('#room-code-input', { visible: true });
            await page.type('#room-code-input', roomId);
            await page.click('button[onclick="joinCustomRoom()"]');
            await page.waitForSelector('#group-active:not(.hidden)', { visible: true });
            console.log(`[${name}] Joined room ${roomId}`);
        }

        await joinRoom(page1, 'User1', testRoomId);
        await joinRoom(page2, 'User2', testRoomId);

        const testRoomMsg = "Secret Room Message " + Date.now();
        
        await page1.type('#group-msg-input', testRoomMsg);
        await page1.keyboard.press('Enter');
        console.log(`[User1] Sent encrypted room message: ${testRoomMsg}`);

        await page2.waitForFunction(
            (msg) => {
                const boxes = document.querySelectorAll('#group-chat-box .chat-bubble');
                for (let b of boxes) {
                    if (b.innerText.includes(msg)) return true;
                }
                return false;
            },
            { timeout: 5000 },
            testRoomMsg
        );
        console.log(`[User2] Successfully decrypted and received room message.`);

        // ==========================================
        // TEST 3: LEAVE CUSTOM ROOM
        // ==========================================
        console.log("\n--- Running Test 3: Leave Custom Room ---");

        // User 1 clicks leave
        await page1.waitForSelector('button[onclick="leaveCustomRoom()"]', { visible: true });
        await page1.click('button[onclick="leaveCustomRoom()"]');
        console.log("[User1] Clicked Leave button");

        // Wait for User1 to be back to idle state
        await page1.waitForSelector('#group-idle:not(.hidden)', { visible: true });
        console.log("[User1] Returned to group-idle view");

        // User 2 should receive system message about User1 leaving
        await page2.waitForFunction(
            () => {
                const boxes = document.querySelectorAll('#group-chat-box .text-xs');
                for (let b of boxes) {
                    if (b.innerText.includes("left the group.")) return true;
                }
                return false;
            },
            { timeout: 5000 }
        );
        console.log("[User2] Received system message that partner left the group.");

        // ==========================================
        // TEST 4: RANDOM CHAT & NEW FEATURES
        // ==========================================
        console.log("\n--- Running Test 4: Random Chat Matchmaking ---");
        await page1.click('#nav-random');
        await page2.click('#nav-random');

        // Click Start Searching
        await page1.waitForSelector('#btn-start', { visible: true });
        await page1.click('#btn-start');
        await page2.waitForSelector('#btn-start', { visible: true });
        await page2.click('#btn-start');
        
        console.log("[User1] Started searching...");
        console.log("[User2] Started searching...");

        // Wait for connection (Next button should appear when connected)
        await page1.waitForSelector('#btn-next-header', { visible: true, timeout: 15000 });
        await page2.waitForSelector('#btn-next-header', { visible: true, timeout: 15000 });
        console.log("Both users successfully matched in Random Chat.");

        // Check if Mic/Cam toggles exist
        const micToggle1 = await page1.$('#btn-mic');
        const camToggle1 = await page1.$('#btn-cam');
        if (micToggle1 && camToggle1) {
            console.log("Mic and Cam toggle buttons found.");
        } else {
            throw new Error("Mic or Cam toggle button not found!");
        }

        // Send message in Random Chat
        const randomMsg = "Hello Random from Test " + Date.now();
        await page1.type('#random-msg-input', randomMsg);
        await page1.keyboard.press('Enter');
        console.log(`[User1] Sent random message: ${randomMsg}`);

        await page2.waitForFunction(
            (msg) => {
                const boxes = document.querySelectorAll('#random-chat-box .chat-bubble');
                for (let b of boxes) {
                    if (b.innerText.includes(msg)) return true;
                }
                return false;
            },
            { timeout: 5000 },
            randomMsg
        );
        console.log(`[User2] Successfully received random message.`);

        // ==========================================
        // TEST 5: MEDIA UPLOAD (IMAGE & VOICE)
        // ==========================================
        console.log("\n--- Running Test 5: Media Upload (Image & Voice) ---");
        
        // 5A: Image Upload
        await new Promise(r => setTimeout(r, 1000)); // bypass anti-spam
        const [fileChooser] = await Promise.all([
            page1.waitForFileChooser(),
            page1.evaluate(() => triggerUpload())
        ]);
        await fileChooser.accept([path.resolve(__dirname, 'icon-192.png')]);
        console.log("[User1] Uploaded image icon-192.png via Base64 WebSocket");

        try {
            // Wait for image container to appear on User2
            await page2.waitForSelector('#random-chat-box img', { visible: true, timeout: 8000 });
            console.log("[User2] Successfully received image message in chat.");

            // Click the blurred image to open full-screen preview
            await page2.click('#random-chat-box img');
            console.log("[User2] Clicked blurred image to open view-once preview");

            // Wait for the modal dialog to open
            await page2.waitForFunction(
                () => {
                    const modal = document.getElementById('img_modal');
                    return modal && modal.open === true;
                },
                { timeout: 5000 }
            );
            console.log("[User2] View-once image modal is open.");

            // Close the modal
            await page2.evaluate(() => document.getElementById('img_modal').close());
            console.log("[User2] Closed image modal.");

            // Verify that the view-once image container is replaced by "Media dibuka"
            await page2.waitForFunction(
                () => {
                    const box = document.getElementById('random-chat-box');
                    return box && box.innerText.includes("Media dibuka");
                },
                { timeout: 5000 }
            );
            console.log("[User2] View-once image vanished and turned into placeholder successfully!");
        } catch (e) {
            const html = await page2.evaluate(() => document.getElementById('random-chat-box').innerHTML);
            console.error("[User2] Chat box HTML at failure:\n", html);
            throw e;
        }

        // 5B: Voice Record
        await new Promise(r => setTimeout(r, 1000)); // bypass anti-spam
        // Grant permissions in puppeteer
        const context1 = browser1.defaultBrowserContext();
        await context1.overridePermissions(SITE_URL, ['microphone', 'camera']);
        
        await page1.click('#record-btn-random');
        console.log("[User1] Started real voice recording...");
        await new Promise(r => setTimeout(r, 2000)); // record for 2 seconds
        await page1.click('#record-btn-random');
        console.log("[User1] Stopped voice recording, sending via Base64 WebSocket...");

        try {
            await page2.waitForFunction(
                () => {
                    const audios = document.querySelectorAll('#random-chat-box audio');
                    return audios.length > 0;
                },
                { timeout: 10000 }
            );
            console.log("[User2] Successfully received voice message.");
        } catch (e) {
            const html = await page2.evaluate(() => document.getElementById('random-chat-box').innerHTML);
            console.error("[User2] Chat box HTML at failure:\n", html);
            throw e;
        }

        console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
    } catch (e) {
        console.error("\n❌ TEST FAILED:");
        console.error(e);
        process.exitCode = 1;
    } finally {
        await browser1.close();
        await browser2.close();
    }
})();
