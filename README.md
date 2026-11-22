# Pic League

Profile photos ki marble race. TikTok Live pe jo bhi viewer comment, like, gift, follow ya join kare, uski photo aur naam apne aap game mein aa jaata hai. Lobby timer khatam hote hi race shuru hoti hai, aur result ke baad agla round khud chalta hai.

## Do tareeke se chalta hai

1. **Manual:** game page kholo, photos chuno, Start dabao. Server ki zaroorat nahi. GitHub Pages ka link yahi karta hai.
2. **TikTok Live:** neeche wala server chalao. Game ko server wale address se kholna hai, GitHub Pages wale link se nahi.

## TikTok Live server chalana

Node.js 18 ya naya chahiye.

**Computer pe**

1. Node.js install karo (nodejs.org).
2. Is repo ko download karo (Code > Download ZIP) aur extract karo.
3. Folder mein terminal kholo:

```
npm install
node server.js TUMHARA_TIKTOK_USERNAME
```

4. Browser mein `http://localhost:8080` kholo. Menu mein **TikTok Live game shuru karo** dabao.

**Android phone pe (Termux)**

```
pkg install nodejs git
git clone https://github.com/farufensil-creator/pic-league
cd pic-league
npm install
node server.js TUMHARA_TIKTOK_USERNAME
```

Phir Chrome mein `http://localhost:8080` kholo.

## Pehle test karo

Bina TikTok ke nakli viewers se dekhne ke liye:

```
node server.js --demo
```

## Dhyan rakhne wali baatein

- Aapka TikTok account abhi live hona chahiye. Nahi hoga to server har 15 second mein dobara try karta hai.
- Ye unofficial library (`tiktok-live-connector`) use karta hai. TikTok kabhi bhi isko tod sakta hai. Password kahin nahi daalna padta.
- Agar limit ki dikkat aaye to EulerStream ki API key lekar chalao: `SIGN_API_KEY=xxxx node server.js username`
- Photo ki jagah sirf do akshar (initials) dikhe to terminal mein `[info] pehle user ke fields` wali line copy karke bhejo.
