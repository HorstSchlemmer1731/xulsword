/*  This file is part of xulSword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

    xulSword is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    xulSword is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with xulSword.  If not, see <http://www.gnu.org/licenses/>.
*/

Texts = {
  
  scrollTypeFlag:null,
  hilightFlag:null,
  scrollDelta:null,
  
  display:[null, null, null, null],
  
  pinnedDisplay:[null, null, null, null],
  
  footnotes:[null, null, null, null],

  // The force parameter is an array of values, one for each window, 
  // beginning with index 1 (0 is null). Each value has the following
  // possibilities:
  // -1 means don't update this window
  // 0 means update if a watched value has changed (as normal)
  // 1 means update always
  update: function(scrollTypeFlag, hilightFlag, force) {
    var save = { p1:scrollTypeFlag, p2:hilightFlag, p3:force }; // save for passing on to other ViewPorts later

    // default intput params...
    if (scrollTypeFlag === undefined) scrollTypeFlag = SCROLLTYPEPREVIOUS;
    if (hilightFlag === undefined) hilightFlag = HILIGHTPREVIOUS;
    if (force === undefined) force = [null, 0, 0, 0];
    
    if (scrollTypeFlag == SCROLLTYPEPREVIOUS) scrollTypeFlag = this.scrollTypeFlag;
    else {this.scrollTypeFlag = scrollTypeFlag;}
    
    if (hilightFlag == HILIGHTPREVIOUS) hilightFlag = this.hilightFlag;
    else {this.hilightFlag = hilightFlag;}
    
//jsdump("scrollTypeFlag=" + scrollTypeFlag + ", hilightFlag=" + hilightFlag + ", force=" + force);
    
    Popup.close();
    
    ViewPort.update(false);
    
    for (var w=1; w<=NW; w++) {
      
      if (document.getElementById("text" + w).getAttribute("columns") == "hide") continue;
      if (document.getElementById("text" + w).getAttribute("moduleType") == "none") continue;
      if (w > ViewPort.NumDisplayedWindows) continue;
      if (force[w] == -1) continue;
      
      // then update this window...
      var modType = Tab[ViewPort.Module[w]].modType;
      
      if (!this.pinnedDisplay[w]) ViewPort.IsPinned[w] = false;
    
      if (this.scrollTypeFlag == SCROLLTYPETOP && 
          !ViewPort.IsPinned[w] && 
          (modType == BIBLE || modType == COMMENTARY)) {
        Location.setVerse(prefs.getCharPref("DefaultVersion"), 1, 1);
      }
      
      // get current global ViewPort display params for this window
      var display = this.getWindowDisplay(w);
     
      // reset some or all display params with pinned values if we're pinned
      if (ViewPort.IsPinned[w]) {
        // reset any pinned params which should not track unpinned 
        // windows' values. These may have been manually changed since the  
        // last display due to operation of a pinned window's own controls.
        
        // pinned windowed ViewPorts should not track XS_window at all
        if (this !== XS_window.Texts) {
          display = deepClone(this.pinnedDisplay[w]);
        }
        // pinned MainWidow ViewPort tracks everything except the following:
        else {
          var keepPinned = ["scrollTypeFlag", "mod", "bk", "ch", "vs", "lv", "Key"];
          for (var x=0; x<keepPinned.length; x++) {
            display[keepPinned[x]] = this.pinnedDisplay[w][keepPinned[x]];
          }
        }
        
        display.hilightFlag = HILIGHTNONE; // pinned windows never have hilight
      }
   
      switch(modType) {
        
      case BIBLE:
        this.updateBible(w, display, force[w]);
        break;
        
      case COMMENTARY:
        this.updateCommentary(w, display, force[w]);
        break;
      
      case DICTIONARY:
        this.updateDictionary(w, display, force[w]);
        break;
        
      case GENBOOK:
        this.updateGenBook(w, display, force[w]);
        break;

      }
      
      // save the display objects for this window
      this.display[w] = deepClone(display);
      this.pinnedDisplay[w] = deepClone(display);
    }
/*    
    // scroll notebox to text always. SHOULD THIS BE IN VIEWPORT UPDATE?
    for (var w=1; w<=NW; w++) {
      //if (Tab[ViewPort.Module[w]].modType != BIBLE) continue;
      if (document.getElementById("text" + w).getAttribute("columns") == "hide") continue;
      if (document.getElementById("text" + w).style.display == "none") continue; // used by windowed viewports
      if (w > ViewPort.NumDisplayedWindows) continue;
      var aoref = this.display[w].bk + "." + this.display[w].ch + "." + this.display[w].vs;
      var t = document.getElementById("text" + w);
      var sb = t.getElementsByClassName("sb")[0];
      var firstVerse = sb.innerHTML.indexOf("title=\"" + aoref + ".");
      if (firstVerse != -1) {
        var nre = new RegExp("class=\"(fn|cr|un)\" title=\"([^\"]+)\"");
        var firstNote = sb.innerHTML.substr(firstVerse).match(nre);
        if (firstNote) BibleTexts.scroll2Note("w" + w + ".footnote." + firstNote[1] +"." + firstNote[2]);
      }
    }
*/    
    // If scrollTypeFlag is SCROLLTYPEENDSELECT, then the selection has been changed to the
    // the first visible verse. To maintain subsequent SCROLLTYPEPREVIOUS functionality, we
    // need to also change our current scrollTypeFlag to SCROLLTYPEBEG
    if (this.scrollTypeFlag == SCROLLTYPEENDSELECT) this.scrollTypeFlag = SCROLLTYPEBEG;
    
    
    // If this is the XS_window.Text object which we just updated, then go and update any
    // other unpinned windowed ViewPort Text objects. Plus update navigator and history.
    if (this === XS_window.Texts) {

      var allViewPortWindows = Components.classes['@mozilla.org/appshell/window-mediator;1'].
        getService(Components.interfaces.nsIWindowMediator).getEnumerator("viewport");
        
      while (allViewPortWindows.hasMoreElements()) {
        var aViewPortWindow = allViewPortWindows.getNext();

        // then update Text of a windowed ViewPort, skipping pinned windows entirely
        for (w=1; w<=NW; w++) {
          if (aViewPortWindow.ViewPort.IsPinned[w]) {
            if (!save.p3) save.p3 = [null, 0, 0, 0];
            save.p3[w] = -1; // don't update if pinned
          }
        }

        aViewPortWindow.Texts.update(save.p1, save.p2, save.p3);
      }
      
      XS_window.updateNavigator();
    
      try {XS_window.clearTimeout(XS_window.History.timer);} catch(er){} 
      XS_window.History.timer = XS_window.setTimeout(function () {XS_window.History.add();}, XS_window.History.delay);
    
    }

  },
  
  updateBible: function(w, display, force) {
  
    var t = document.getElementById("text" + w);
    var ltr = (ModuleConfigs[display.mod].direction == "ltr");
    var sb = t.getElementsByClassName("sb")[0];
    
    // the class of sb must be that of the module
    sb.className = sb.className.replace(/\s*cs\-\S+/, "") + " cs-" + display.mod;

    // don't read new text if the results will be identical to the last displayed text
    var textUpdated = false;
    var check = ["mod", "bk", "ch", "globalOptions", "ShowOriginal", "ShowFootnotesAtBottom", 
                "ShowCrossrefsAtBottom", "ShowUserNotesAtBottom", "columns"];

    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      textUpdated = true;
//jsdump("Reading text from libsword w" + w);
      var prev = {htmlText:"", htmlNotes:"", footnotes:""};
      var next = {htmlText:"", htmlNotes:"", footnotes:""};

      // Get any additional chapters needed to fill multi-column Bible displays.
      // Any verse in the display chapter should be scrollable (top, center, or bottom)
      // while still resulting in a filled multi-column display, if possible.
      if ((/^show(2|3)$/).test(t.getAttribute("columns"))) {
        
        var d2 = deepClone(display);
  
        // collect previous chapter(s)
        var c = Number(display.ch) - 1;
        while (c > 0) {
//jsdump("reading w" + w + ": " + c);
          d2.ch = c;
          var tip = BibleTexts.read(w, d2);
          if (tip.htmlText.length <= 32) break; // stop if chapter is missing
          prev.htmlText = tip.htmlText + prev.htmlText;
          prev.htmlNotes = tip.htmlNotes + prev.htmlNotes;
          prev.footnotes = tip.footnotes + prev.footnotes;
          sanitizeHTML(sb, prev.htmlText);
          if ( (ltr && sb.lastChild.offsetLeft >= sb.offsetWidth) || 
               (!ltr && sb.lastChild.offsetLeft < 0) ) break;
          c--;
        }
      
        // collect next chapter(s)
        var c = Number(display.ch) + 1;
        while (c <= LibSword.getMaxChapter(d2.mod, d2.bk + "." + d2.ch)) {
//jsdump("reading w" + w + ": " + c);
          d2.ch = c;
          var tip = BibleTexts.read(w, d2);
          if (tip.htmlText.length <= 32) break; // stop if chapter is missing
          next.htmlText = next.htmlText + tip.htmlText;
          next.htmlNotes = next.htmlNotes + tip.htmlNotes;
          next.footnotes = next.footnotes + tip.footnotes;
          sanitizeHTML(sb, next.htmlText);
          if ( (ltr && sb.lastChild.offsetLeft >= sb.offsetWidth) || 
               (!ltr && sb.lastChild.offsetLeft < 0) ) break;
          c++;
        }
        
      }
//jsdump("reading w" + w + ": " + display.ch);
      var ti = BibleTexts.read(w, display);
        
      var hd = t.getElementsByClassName("hd")[0];

      sanitizeHTML(hd, ti.htmlHead);
        
      sanitizeHTML(sb, prev.htmlText + (ti.htmlText.length > 64 ? ti.htmlText:"") + next.htmlText);

      var nb = t.getElementsByClassName("nb")[0];
      this.footnotes[w] = prev.footnotes + ti.footnotes + next.footnotes;
      sanitizeHTML(nb, prev.htmlNotes + ti.htmlNotes + next.htmlNotes);
    }
    
    if (textUpdated || this.isChanged(['vs', 'scrollTypeFlag'], display, this.display[w])) {
      // handle scroll
      this.scroll2Verse(w, display);
      
      // handle highlights
      this.hilightVerses(w, display);
      
      // remove notes which aren't in window, or hide notebox entirely if empty
      t.setAttribute("footnotesEmpty", !BibleTexts.checkNoteBox(w))
    }
    
    // set audio icons
    window.setTimeout(function () {BibleTexts.updateAudioLinks(w);}, 0);
    
  },
  
  updateCommentary: function(w, display, force) {
  
    var t = document.getElementById("text" + w);
    var ltr = (ModuleConfigs[display.mod].direction == "ltr");
    var sb = t.getElementsByClassName("sb")[0];
    
    // the class of sb must be that of the module
    sb.className = sb.className.replace(/\s*cs\-\S+/, "") + " cs-" + display.mod;

    // don't read new text if the results will be identical to the last displayed text
    var textUpdated = false;
    var check = ["mod", "bk", "ch", "globalOptions", "ShowFootnotesAtBottom", 
                "ShowCrossrefsAtBottom", "ShowUserNotesAtBottom", "columns"]
     
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      textUpdated = true;
      var ti = CommTexts.read(w, display);

      var hd = t.getElementsByClassName("hd")[0];
      sanitizeHTML(hd, ti.htmlHead);
      
      sanitizeHTML(sb, (ti.htmlText.length > 64 ? ti.htmlText:""));
      
      var nb = t.getElementsByClassName("nb")[0];
      this.footnotes[w] = ti.footnotes;
      sanitizeHTML(nb, ti.htmlNotes);
    }
    
    if (textUpdated || this.isChanged(['vs', 'scrollTypeFlag'], display, this.display[w])) {
      // handle scroll
      this.scroll2Verse(w, display);
      
      // handle highlights
      display.hilightFlag = HILIGHTNONE;
      this.hilightVerses(w, display);
      
      // hide notebox entirely if empty
      t.setAttribute("footnotesEmpty", !BibleTexts.checkNoteBox(w))
  
    }
  },
  
  updateGenBook: function(w, display, force) {

    ViewPort.ShowOriginal[w] = false;
    ViewPort.MaximizeNoteBox[w] = false;
    
    var t =  document.getElementById("text" + w);
    var ltr = (ModuleConfigs[display.mod].direction == "ltr");
    var sb = t.getElementsByClassName("sb")[0];
    
    // the class of sb must be that of the module
    sb.className = sb.className.replace(/\s*cs\-\S+/, "") + " cs-" + display.mod;
    
    // reset key if the module has changed since last read
    if (!this.display[w] || this.display[w].mod != display.mod) {
      var ch = GenBookTexts.firstRdfChapter(display.mod);
      display.Key = (ch && GenBookNavigator.RDFCHAPTER.test(ch) ? ch.match(GenBookNavigator.RDFCHAPTER)[2]:"");
    }
  
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "Key", "globalOptions"];
 
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      var ti = GenBookTexts.read(w, display);
     
      this.footnotes[w] = ti.footnotes;
      
      var hd = t.getElementsByClassName("hd")[0];
      sanitizeHTML(hd, ti.htmlHead);
      
      sanitizeHTML(sb, ti.htmlText);

    }
  
    // handle scroll
    if (display.scrollTypeFlag != SCROLLTYPENONE) {
      if (display.scrollTypeFlag == SCROLLTYPEDELTA) GenBookTexts.scrollDelta(w, this.scrollDelta);
      else {
        sb.scrollTop = 0;
        sb.scrollLeft = 0;
      }
    }
    
    // set audio icons
    window.setTimeout(function () {GenBookTexts.updateAudioLinks(w);}, 0);
    
  },
  
  updateDictionary: function(w, display, force) {

    ViewPort.IsPinned[w] = false;
    ViewPort.ShowOriginal[w] = false;
    ViewPort.MaximizeNoteBox[w] = false;

    var t =  document.getElementById("text" + w);
    var ltr = (ModuleConfigs[display.mod].direction == "ltr");
    var sb = t.getElementsByClassName("sb")[0];
    
    // reset key if the module has changed since last read
    if (!this.display[w] || this.display[w].mod != display.mod) {
      display.Key = (SpecialModules.DailyDevotion.hasOwnProperty(display.mod) ? "DailyDevotionToday":"");
    }

    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "Key", "globalOptions"];
    
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      var ti = DictTexts.read(w, display);
      
      this.footnotes[w] = ti.footnotes;
      
      var hd = t.getElementsByClassName("hd")[0];
      sanitizeHTML(hd, ti.htmlHead);
      
      sanitizeHTML(sb, ti.htmlEntry);
      
      var nb = t.getElementsByClassName("nb")[0];
      display.htmlList = ti.htmlList;
      if (force || !this.display[w] || 
          !this.display[w].hasOwnProperty("htmlList") || 
          this.display[w].htmlList !== ti.htmlList) {
            
        while (nb.firstChild) {nb.removeChild(nb.firstChild);}
        nb.appendChild(document.importNode(ti.htmlList, true));
        
        var keytextbox = nb.getElementsByClassName("keytextbox");
        if (keytextbox && keytextbox.length) keytextbox = keytextbox[0];
        if (keytextbox) {
          keytextbox.addEventListener("focus", function(event) {event.target.select();});
          keytextbox.addEventListener("dblclick", function(event) {event.target.select();});
          keytextbox.addEventListener("keypress", function(event) {DictTexts.keyPress(event);});
        }
        
        var keylist = nb.getElementsByClassName("keylist")[0];
        if (keylist && keylist.length) keylist = keylist[0];
        if (keylist) keylist.addEventListener("click", function(event) {DictTexts.selKey(event);});
        
      }
    
      // highlight the selected key
      var k = document.getElementById("note" + w).getElementsByClassName("dictselectkey");
      while (k.length) {k[0].className = k[0].className.replace(" dictselectkey", "");}
      k = document.getElementById("note" + w).getElementsByClassName(encodeURIComponent(display.Key));
      if (k && k.length) {
        k[0].className += " dictselectkey";
        k[0].scrollIntoView();
        document.getElementById("viewportbody").scrollTop = 0; // fix scrollIntoView issue
      }

      document.getElementById("note" + w).getElementsByClassName("keytextbox")[0].value = display.Key;
      ViewPort.Key[w] = display.Key;
      
    }
    
    // handle scroll
    if (display.scrollTypeFlag != SCROLLTYPENONE) {
      sb.scrollTop = 0;
      sb.scrollLeft = 0;
    }
  },


  //////////////////////////////////////////////////////////////////////
  // Texts Utility functions
  //////////////////////////////////////////////////////////////////////

  // Dynamically resize the chapter heading, starting from stylesheet's value
  //var chaptitle = sb.getElementsByClassName("chaptitle")[0];
  //Texts.fitHTML(chaptitle, sb.offsetWidth/2, this.ChapTitleFontSize);
  //ChapTitleFontSize: getCSS(".chaptitle {").style.fontSize.match(/([\-\d]+)px/)[1],
  
  // Adjusts font-size of passed HTML element,
  // stopping at given overall offset width.
  fitHTML: function(elem, w, maxfs) {
    var fs = (maxfs ? maxfs:20);
    elem.style.fontSize = fs + "px";
//jsdump("A-" + w + ":" + fs + ", " + elem.offsetWidth + ", " + w);
    while (fs > 8 && elem.offsetWidth > w) {
      fs -= 2;
      elem.style.fontSize = fs + "px";
//jsdump("B-" + w + ":" + fs + ", " + elem.offsetWidth + ", " + w);
    }
  
  },

  getPageLinks: function() {
    var config = LocaleConfigs[getLocale()];
    var charNext = (config.direction && config.direction == "rtl" ? String.fromCharCode(8592):String.fromCharCode(8594));
    var charPrev = (config.direction && config.direction == "rtl" ? String.fromCharCode(8594):String.fromCharCode(8592));

    var html = "";
    html += "<div class=\"navlink\">";
    html +=   "&lrm;<span class=\"navlink-span\">" + charPrev + "</span> " + "<a class=\"prevchaplink\">" + XSBundle.getString('PrevChaptext') + "</a>";
    html +=   " / ";
    html +=   "<a class=\"nextchaplink\">&lrm;" + XSBundle.getString('NextChaptext') + "</a>" + " <span class=\"navlink-span\">" + charNext + "</span>";
    html += "</div>";
    
    return html;
  },
  
  getUserNotes: function(bk, ch, mod, text) {
    if (text === null) text = "";
    var usernotes = {html:text, notes:""};
     
    var usesVerseKey = (Tab[mod].modType == BIBLE || Tab[mod].modType == COMMENTARY);
    
    // Search User Data for notes with this book, chapter, and version
    var recs = BMDS.GetAllResources();
    while (recs.hasMoreElements()) {
      var res = recs.getNext();
      if (!ResourceFuns.isItemChildOf(res, BM.AllBookmarksRes, BMDS)) continue;
      if (BM.RDFCU.IsContainer(BMDS, res)) {continue;}
      
      // only show bookmarks which are usernotes
      var note = BMDS.GetTarget(res, BM.gBmProperties[NOTE], true);
      if (!note) continue;
      note = note.QueryInterface(Components.interfaces.nsIRDFLiteral);
      if (!note) continue;
      note=note.Value;
      if (!note) {continue;}
      
      // is this note in the module?
      try {var module = BMDS.GetTarget(res, BM.gBmProperties[MODULE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
      if (module != mod) continue;
      
      // is this note in the chapter?
      try {var chapter = BMDS.GetTarget(res, BM.gBmProperties[CHAPTER], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;} 
      if (usesVerseKey) {
        if (chapter != String(ch)) continue;
        try {var book = BMDS.GetTarget(res, BM.gBmProperties[BOOK], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
        if (book != bk) continue;
      }
      else {
        if (chapter != ch) continue;
        book = "na";
        chapter = "1";
      }
      
      // get the verse where the note is
      try {var verse = BMDS.GetTarget(res, BM.gBmProperties[VERSE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
       
      // We have a keeper, lets save the note and show it in the text!
      // Encode ID
      var resval = res.QueryInterface(Components.interfaces.nsIRDFResource).ValueUTF8;
      var title =  encodeURIComponent(resval) + "." + bk + "." + encodeURIComponent(ch) + "." + verse + "." + mod;
      var newNoteHTML = "<span class=\"un\" title=\"" + title + "\" ></span>";
      
      // if this is a selected verse, place usernote inside the verse element (like regular notes)
      if (usesVerseKey) {
        var re = new RegExp("(title=\"" + bk + "." + ch + "." + verse + "." + mod + "\" class=\"vs)([^>]*>)(\\s*<span.*?>)?", "im");
        usernotes.html = usernotes.html.replace(re, "$1 un-hilight$2$3" + newNoteHTML);
      }
      else {
        // All non-versekey usernotes are placed at the beginning of the HTML container
        re = new RegExp("(class=\"cs-" + mod + ")([^>]*>\\s*)", "im");
        usernotes.html = usernotes.html.replace(re, "$1 un-hilight$2" + newNoteHTML);
      }
      
      usernotes.notes += "<div class=\"nlist\" title=\"un." + title + "\">" + note + "</div>";

    }
    
    return usernotes;
  },
  
  getWindowDisplay: function(w) {
    var display = {};
    
    display.Key = ViewPort.Key[w];
    display.ShowOriginal = ViewPort.ShowOriginal[w];
    display.MaximizeNoteBox = ViewPort.MaximizeNoteBox[w];
    var c = document.getElementById("text" + w);
    display.columns = (c ? c.getAttribute("columns"):null);
    
    return this.getDisplay(ViewPort.Module[w], Location.getLocation(ViewPort.Module[w]), display);
  },
 
  getDisplay: function(mod, loc, display) {
    if (!display) display = {};
    display.globalOptions = {};
    
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") 
        display.globalOptions[GlobalToggleCommands[cmd]] = prefs.getCharPref(GlobalToggleCommands[cmd]);
      else display.globalOptions[GlobalToggleCommands[cmd]] = LibSword.getGlobalOption(GlobalToggleCommands[cmd]);
    }
    
    display.mod = mod;
    display.location = loc;
    
    loc = display.location.split(".");
    
    display.bk = loc[0];
    display.ch = Number((loc[1] ? loc[1]:1));
    display.vs = Number((loc[2] ? loc[2]:1));
    display.lv = Number((loc[3] ? loc[3]:1));
    
    display.scrollTypeFlag = this.scrollTypeFlag;
    display.hilightFlag = this.hilightFlag;
    
    display.ShowFootnotesAtBottom = getPrefOrCreate("ShowFootnotesAtBottom", "Bool", true);
    display.ShowCrossrefsAtBottom = getPrefOrCreate("ShowCrossrefsAtBottom", "Bool", false);
    display.ShowUserNotesAtBottom = getPrefOrCreate("ShowUserNotesAtBottom", "Bool", true);
    
    return display;
  },
  
  isChanged: function(check, display1, display2) {
    for (var i=0; i<check.length; i++) {
      if (check[i] == "globalOptions") {
        for (var cmd in GlobalToggleCommands) {
          if (display1.globalOptions[GlobalToggleCommands[cmd]] != 
              display2.globalOptions[GlobalToggleCommands[cmd]]) {
//jsdump("changed=" + GlobalToggleCommands[cmd]);
            return true;
          }
        } 
      }
      else if (display1[check[i]] != display2[check[i]]) {
//jsdump("changed=" + check[i]);
        return true;
      }
    }
//jsdump("no change");
    return false;
  },

  // scrolls a window according to display settings. 
  // returns true if a scroll change occurred or false otherwise
  scroll2Verse: function(w, d) {
    var scrollChanged = false;
    
    if (!d.location) return false;
//jsdump("SCROLLING w=" + w + ", display=" + uneval(d));

    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    
    var startScrollTop = sb.scrollTop;
    
    if (sb.scrollLeft) scrollChanged = true;
    sb.scrollLeft = 0; // commentary may have been non-zero
    
    var l = d.location.split(".");
    var bk = l[0];
    var ch = (l[1] ? Number(l[1]):1);
    var vs = (l[2] ? Number(l[2]):1);
    var lv = (l[3] ? Number(l[3]):l[2]);
    
    // find the element to scroll to
    var av = sb.firstChild;
    var v = null;
    var vf = null;
    while (av && !v) {
      var p = getElementInfo(av);
      if (p && p.type == "vs") {
        if (!vf && p.bk == bk && p.ch == ch) vf = av;
          
        if (p.bk == bk && p.ch == ch && p.vs == vs) v = av;
      }
      av = av.nextSibling;
    }
    
    // if not found, use first verse in current chapter
    if (!v) v = vf;
  
    // if neither verse nor chapter has been found, return false
    if (!v) return (scrollChanged || startScrollTop != sb.scrollTop);
//jsdump("v=" + uneval(getElementInfo(v)));

    // perform appropriate scroll action
    var vOffsetTop = v.offsetTop;
    var vt = v;
    while (vt && vt.parentNode !== v.offsetParent) {
      vt = vt.parentNode; 
      if (vt && vt.offsetTop) vOffsetTop -= vt.offsetTop;
    }
    
    // some special rules for commentaries
    if (Tab[d.mod].modType == COMMENTARY) {
      
      // if part of commentary element is already visible, don't rescroll
      if ((vOffsetTop < sb.scrollTop) &&
          (vOffsetTop + v.offsetHeight > sb.scrollTop + 20)) {
        return (scrollChanged || startScrollTop != sb.scrollTop);
      }
          
      // commentaries should never scroll verse to middle, only to top
      if (d.scrollTypeFlag == SCROLLTYPECENTER || d.scrollTypeFlag == SCROLLTYPECENTERALWAYS)
          d.scrollTypeFlag = SCROLLTYPEBEG;
          
    }
      
    // if this is verse 1 then SCROLLTYPEBEG and SCROLLTYPECENTER both become SCROLLTYPETOP
    if (vs == 1 && (d.scrollTypeFlag == SCROLLTYPEBEG || d.scrollTypeFlag == SCROLLTYPECENTER)) {
      d.scrollTypeFlag = SCROLLTYPETOP;
    }
  
    // scroll single column windows...
    if (t.getAttribute("columns") == "show1") {
      
      switch (d.scrollTypeFlag) {
      case SCROLLTYPENONE:         // don't scroll (for links this becomes SCROLLTYPECENTER)
        break;
      case SCROLLTYPETOP:          // scroll to top
        sb.scrollTop = 0;
        break;
      case SCROLLTYPEBEG:          // put selected verse at the top of the window or link
        sb.scrollTop = vOffsetTop;
        break;
      case SCROLLTYPECENTER:       // put selected verse in the middle of the window or link, unless verse is already entirely visible or verse 1
        if (vs != 1 && ((vOffsetTop + v.offsetHeight) > (sb.scrollTop + sb.offsetHeight) || vOffsetTop < sb.scrollTop)) {
          var middle = Math.round(vOffsetTop - (sb.offsetHeight/2) + (v.offsetHeight/2));
          // if beginning of verse is not showing then make it show
          if (vOffsetTop < middle) {sb.scrollTop = vOffsetTop;}
          else {sb.scrollTop = middle;}
        }
        break;
      case SCROLLTYPECENTERALWAYS: // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
          var middle = Math.round(vOffsetTop - (sb.offsetHeight/2) + (v.offsetHeight/2));
          if (vOffsetTop < middle) {sb.scrollTop = vOffsetTop;}
          else {sb.scrollTop = middle;}
        break;
      case SCROLLTYPEEND:          // put selected verse at the end of the window or link, and don't change selection
      case SCROLLTYPEENDSELECT:    // put selected verse at the end of the window or link, then select first verse of link or verse 1
        sb.scrollTop = vOffsetTop + v.offsetHeight - sb.offsetHeight;
        if (d.scrollTypeFlag == SCROLLTYPEENDSELECT) {
          // then set Location to first visible verse- but not implemented because not yet used
        }
        break;
      }
    }
    
    // or scroll multi-column windows...
    else {
      scrollChanged = true;

      switch (d.scrollTypeFlag) {

      case SCROLLTYPETOP:          // scroll to top
        // hide all verses previous to scroll verse's chapter
        var vs = sb.lastChild;
        var show = true;
        while(vs) {
          var p = getElementInfo(vs);
          if (p && p.type == "vs" && p.ch == (ch-1)) show = false;
          // must always check for (vs.style) because pre-verse titles  
          // may begin with a Text node which will not have a style prop.
          if (vs.style) vs.style.display = (show ? "":"none");
          vs = vs.previousSibling;
        }
        break;
      case SCROLLTYPEBEG:          // put selected verse at the top of the window or link
        // Hide all verses before the scroll verse. If the scroll verse is immediately preceded by
        // consecutive non-verse (heading) elements, then show them.
        var vs = sb.lastChild;
        var show = true;
        var showhead = true;
        while(vs) {
          if (!show && showhead) {
            var p = getElementInfo(vs);
            var isverse = (p && p.type == "vs");
            if (vs.style) vs.style.display = (isverse  ? "none":"");
            if (isverse) showhead = false;
          }
          else {
            if (vs.style) vs.style.display = (show ? "":"none");
            if (vs == v) show = false;
          }
          vs = vs.previousSibling;
        }
        break;
      case SCROLLTYPENONE:         // don't scroll (for links this becomes SCROLLTYPECENTER)
      case SCROLLTYPECENTER:       // put selected verse in the middle of the window or link, unless verse is already entirely visible or verse 1
        var ltr = (ModuleConfigs[d.mod].direction == "ltr");
        var tv = sb.firstChild;
        if (vs == 1 || this.isVisibleVerse(v, w)) break;
      case SCROLLTYPECENTERALWAYS: // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
        // hide all elements before verse
        var vs = sb.firstChild;
        var show = false;
        while (vs) {
          if (vs === v) show = true;
          if (vs.style) vs.style.display = (show ? "":"none"); 
          vs = vs.nextSibling;
        }
        // show verse near middle of first column
        vs = v.previousSibling;
        if (vs) {
          var h = 0;
          do {
            if (vs.style) vs.style.display = "";
            h += vs.offsetHeight;
            vs = vs.previousSibling;
          }
          while (vs && h < (sb.offsetHeight/2 - 20));
          if (vs) vs.style.display = "none";
        }
        break;
      case SCROLLTYPEEND:          // put selected verse at the end of the window or link, and don't change selection
      case SCROLLTYPEENDSELECT:    // put selected verse at the end of the window or link, then select first verse of link or verse 1
        var ltr = (ModuleConfigs[d.mod].direction == "ltr");
      
        // show all verses
        var vs = sb.lastChild;
        while (vs) {
          if (vs.style) vs.style.display = "";
          vs = vs.previousSibling;
        }
        // hide verses until last verse is visible
        vs = sb.firstChild;
        while (vs && !this.isVisibleVerse(v, w)) {
          if (vs.style) vs.style.display = "none";
          vs = vs.nextSibling;
        }
        
        if (d.scrollTypeFlag == SCROLLTYPEENDSELECT) {
          var vs = sb.firstChild;
          while(vs) {
            var p = getElementInfo(vs);
            if (p && p.type == "vs" && vs.style && vs.style.display != "none") {
              Location.setLocation(p.mod, p.bk + "." + p.ch + "." + p.vs);
              break;
            }
            vs = vs.nextSibling;
          }
        }

        break;    
      }
    }
  
    return (scrollChanged || startScrollTop != sb.scrollTop);
  },
  
  // returns true if velem is a visible verse element in window w, false otherwise
  isVisibleVerse: function(velem, w) {
    
    // return false if we're not a verse
    if (!velem || !velem.className || !(/^vs(\s|$)/).test(velem.className)) return false;
    
    // return false if we're not visible or being displayed
    var style = window.getComputedStyle(velem);
    if (style.display == "none" || style.visibility == "hidden") return false;
    
    // return false if we're not in the window
    var t = document.getElementById("text" + w);
    var test = velem;
    while(test && test !== t) {test = test.parentNode;}
    if (!test) return false;
    
    var sb = t.getElementsByClassName("sb")[0];
    var nb = document.getElementById("note" + w);
    
    // are we a single column window?
    if (t.getAttribute("columns") == "show1") {
      return ((velem.offsetTop - sb.offsetTop >= sb.scrollTop) &&
          velem.offsetTop - sb.offsetTop < sb.scrollTop + sb.offsetHeight - 30);
    }
    
    // multi-column windows...
    if (ModuleConfigs[ViewPort.Module[w]].direction == "ltr") {
      // we are LTR
      // are we outside the visible columns?
      if (velem.offsetLeft > sb.offsetWidth) return false;
      
      // are we in the last visible column but under the footnote box?
      if (velem.offsetLeft > sb.offsetWidth-(1.1*nb.offsetWidth) && 
          velem.offsetTop+velem.offsetHeight > t.offsetHeight-nb.parentNode.offsetHeight) {
        return false;
      }
      
      // then we must be visible
      return true;
    }

    // we are RTL
    // are we outside the visible columns?
    if (velem.offsetLeft < 0) return false;
    
    // are we in the last visible column but under the footnote box?
    if (velem.offsetLeft < 0.9*nb.offsetWidth && 
        velem.offsetTop+velem.offsetHeight > t.offsetHeight-nb.parentNode.offsetHeight) {
      return false;
    }
    
    // then we must be visible
    return true; 

  },
  
  hilightVerses: function(w, d) {
    if (!d.location || d.hilightFlag == HILIGHTSKIP) return;
 
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    
    var l = d.location.split(".");
    var bk = l[0];
    var ch = (l[1] ? Number(l[1]):1);
    var vs = (l[2] ? Number(l[2]):1);
    var lv = (l[3] ? Number(l[3]):l[2]);
  
    // unhilight everything
    var hl = sb.getElementsByClassName("hl");
    while (hl.length) {hl[0].className = hl[0].className.replace(/\s?hl/, "");}
  
    // find the verse element(s) to hilight
    var av = sb.firstChild;
    while (av) {
      var v = getElementInfo(av);
      if (v && v.type == "vs") {
        var hi = (v.bk == bk && v.ch == ch);
        if (d.hilightFlag == HILIGHTNONE) hi = false;
        if (d.hilightFlag == HILIGHT_IFNOTV1 && 
            (vs == 1 || v.vs < vs || v.vs > lv)) hi = false;
        if (d.hilightFlag == HILIGHTVERSE && 
            (v.vs < vs || v.vs > lv)) hi = false;
     
        if (hi) av.className = (av.className ? av.className + " hl":"hl");
        
      }
      
      av = av.nextSibling;
    }
    
  },

  HTML2text: function(html) {
    var text = html;
    text = text.replace(/(<[^>]+>)/g,"");
    text = text.replace("&nbsp;", " ", "gim");
    return text;
  }

};

