// Static page markup (no user data in here).
export const MARKUP = `<div class="wrap">
  <h1>איפה אנחנו עומדים</h1>
  <p class="sub">כל שקל: איפה הוא נמצא, של מי, ומתי אפשר להגיע אליו. הנתונים שמורים במסד נתונים פרטי, ורק בני הבית שנכנסו עם Google רואים אותם. <a href="/finance/enough">כמה זה מספיק? ←</a></p>

  <section class="fcard">
    <div class="loadbar">
      <label class="drop" id="drop" style="flex:1 1 260px">
        ייבוא מקובץ CSV: גררו לכאן את קובץ המלאי, או <u>לחצו לבחירה</u>
        <input type="file" id="file" accept=".csv,text/csv" hidden>
      </label>
      <div class="toolbar">
        <button id="snap" class="fprimary">שמירת תמונת מצב</button>
        <button id="export">ייצוא ל-CSV</button>
      </div>
    </div>
    <p class="small muted" id="loadinfo" style="margin:8px 0 0"></p>
  </section>

  <div id="demoBanner" class="fbanner demo" hidden>מוצגים <b>נתוני דוגמה</b>. ייבאו את קובץ המלאי (CSV) כדי לראות את התמונה האמיתית, או התחילו ממלאי ריק בסוף העמוד.</div>
  <div id="nudge" class="fbanner nudge" hidden></div>

  <section class="fhero" id="hero" aria-label="מספרים ראשיים"></section>

  <section class="fcard" style="margin-top:18px">
    <div class="maphead">
      <h2 style="margin:0">מפת הנכסים</h2>
      <label class="small"><input type="checkbox" id="hideRE"> בלי נדל״ן</label>
      <div class="fseg" role="group" aria-label="קיבוץ">
        <button data-g="liq" aria-pressed="true">לפי נזילות</button>
        <button data-g="owner" aria-pressed="false">לפי בעלות</button>
        <button data-g="type" aria-pressed="false">לפי סוג</button>
      </div>
    </div>
    <div id="treemap" role="img" aria-label="מפת נכסים לפי גודל"></div>
    <div class="legend" id="legend"></div>
    <div class="liab" id="liab"></div>
    <div class="owners" id="owners"></div>
  </section>

  <section class="fcard">
    <h2>בודק החלטה</h2>
    <div class="two">
      <div class="fform">
        <label>מה
          <input id="dName" value="רכב">
        </label>
        <label>כמה (₪)
          <input id="dAmount" class="num" inputmode="numeric" value="95,000" style="text-align:left">
        </label>
        <label>מאיפה משלמים
          <select id="dSource"></select>
        </label>
        <p class="small muted" style="margin:0">רק מקורות נזילים מופיעים כאן. קרן החירום לא מוצעת כמקור.</p>
      </div>
      <div id="dOut" aria-live="polite"></div>
    </div>
  </section>

  <section class="fcard">
    <h2>מה צריך לבדוק</h2>
    <p class="small muted" style="margin-top:-6px">כל מה שכתוב בעמודה "לבדוק" במלאי. מוחקים את הטקסט כשסיימתם לבדוק. כדאי לעבור על זה בעדכון הרבעוני.</p>
    <ul class="qs" id="qs"></ul>
  </section>

  <section class="fcard scen">
    <h2>תרחישים (לא נספרים בשווי)</h2>
    <p class="small muted" style="margin-top:-6px">אירועים אפשריים, כמו ירושה, שלא בטוחים. התוכנית צריכה לעבוד בלעדיהם. כאן אפשר לראות מה ישתנה אם יקרו.</p>
    <div id="scen"></div>
  </section>

  <section class="fcard">
    <details id="invDetails">
      <summary><h2 style="display:inline">המלאי המלא (עריכה)</h2></summary>
      <p class="small muted">כל שינוי נשמר מיד. שינוי סכום מעדכן את תאריך העדכון להיום.</p>
      <div class="maphead" style="margin-bottom:8px"><span class="small muted">צבע לפי</span>
        <div class="seg2" id="invMode"><button data-m="liq" aria-pressed="true">נזילות</button><button data-m="age" aria-pressed="false">עדכניות</button><button data-m="none" aria-pressed="false">בלי</button></div></div>
      <div class="legend" id="invLegend" style="margin:0 0 10px"></div>
      <div class="tablewrap"><table id="inv"></table></div>
      <p><button id="addRow">+ שורה חדשה</button></p>
    </details>
  </section>

  <section class="fcard">
    <details>
      <summary><h2 style="display:inline">היסטוריה (תמונות מצב)</h2></summary>
      <p class="small muted">תמונת מצב שומרת את המלאי והמספרים הראשיים בתאריך מסוים. ייבוא מחליף את כל המלאי, ולכן שומר קודם תמונה של הקיים.</p>
      <div id="snaps"></div>
    </details>
  </section>

  <footer>הנתונים מוגנים בכניסה עם Google למורשים בלבד. אין כאן ייעוץ השקעות; הערות המס הן כלליות.</footer>

<div id="tooltip" role="tooltip"></div>
</div>`;
