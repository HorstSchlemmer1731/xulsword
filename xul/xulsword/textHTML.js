/*  This file is part of xulSword.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

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


const HTMLbr = "<div style=\"clear: both;\"><br><br></div>";
const HTMLbr0 = "<div style=\"clear: both;\"><br></div>";

function getScriptBoxHeader(myBook, myChap, version, showBookName, showIntroduction, showOriginal) {
  var myVersionsLocale = getLocaleOfVersion(version);
  var myVersionsBundle = myVersionsLocale ? getLocaleBundle(myVersionsLocale, "books.properties"):getCurrentLocaleBundle("books.properties");
  if (!myVersionsBundle) myVersionsBundle = getCurrentLocaleBundle("books.properties");
  var myConfig = myVersionsLocale ? LocaleConfigs[myVersionsLocale]:LocaleConfigs[rootprefs.getCharPref("general.useragent.locale")];
  
  var chapterHeadingFloat = ((myConfig && myConfig.direction && myConfig.direction=="rtl") ? "right":"left");
  var oppositeHeadingFloat = (chapterHeadingFloat == "left" ? "right":"left");
  var chapterHeadingFont = (myConfig && myConfig.font ? myConfig.font:DefaultFont);
  var chapterHeadingSize = (myConfig && myConfig.fontSizeAdjust ? myConfig.fontSizeAdjust:DefaultFontSizeAdjust);
  //var chapterHeadingLineHeight = (myConfig.lineHeight ? myConfig.lineHeight:DefaultLocaleLineHeight); --> line-height:" + chapterHeadingLineHeight + ";
  var mtext ="";
  
  //Start building heading... 
  switch(getModuleLongType(version)) {
  
  case BIBLE:
  case COMMENTARY:
    // book and chapter heading
    mtext += "<div class=\"chapnum\" style=\"margin-top:12px; float:" + chapterHeadingFloat + "; font-family:'" + chapterHeadingFont + "'; font-size-adjust:" + chapterHeadingSize + "; line-height:0.75;\">";
    if (showBookName) {
      mtext += myVersionsBundle.GetStringFromName(myBook);
      mtext += "<br><br>";
    }
    mtext += getLocalizedChapterTerm(myBook, myChap, myVersionsBundle) + "</div>";

    if (!showOriginal) {
      mtext += "<div style=\"margin-top:12px; margin-bottom:-54px; float:" + oppositeHeadingFloat + "; text-align:" + oppositeHeadingFloat + ";\">";
      mtext += "<img name=\"listenlink\" id=\"listenlink." + myChap + "\" class=\"audiolink\" src=\"chrome://xulsword/skin/images/listen.png\" onmouseover=\"scriptboxMouseOver(event)\" onmouseout=\"scriptboxMouseOut(event)\">";
      mtext += "<br><br>";
      
      // introduction link and introduction
      if (myChap==1) {
        var intro = getBookIntroduction(version, myBook, Bible); 
        var test = intro.replace(/<[^>]+>/g,"").match(/\S/); // Remove empty intros that may be generated by paratext2Osis.pl
        if (!test) intro=null;
        if (intro) {
          var linkt = showIntroduction ? myVersionsBundle.GetStringFromName("HideIntroLink"):myVersionsBundle.GetStringFromName("IntroLink");
          var links = showIntroduction ? "hide":"show";
          mtext += "<a class=\"introlink\" title=\"" + links + "\" id=\"introlink\">" + linkt + "</a>";
          mtext += "</div>";
          if (showIntroduction) {
            mtext += HTMLbr + "<span class=\"vstyle" + version + "\">" + intro + "</span>" + HTMLbr;
            // Empty <span> below is added to allow fitpage to put break between end of intro and chapter heading...
            mtext += Vtext1 + "0\"></span>";
          }
        }
        else {mtext += "</div>";}
      }
      else {mtext += "</div>";}    
    }
    break;
    
  case GENBOOK:
    break;
  }
  
  mtext += HTMLbr;
  return mtext;
}

function insertUserNotes(aBook, aChapter, aModule, text) {
  var usernotes = {html:text, notes:""};
  if (prefs.getCharPref("User Notes") != "On") return usernotes;
    
  var myType = getModuleLongType(aModule);
  var usesVerseKey = (myType == BIBLE || myType == COMMENTARY);
  // Search User Data for notes with this book, chapter, and version
  var recs = BMDS.GetAllResources();
  while (recs.hasMoreElements()) {
    var res = recs.getNext();
    var note = BMDS.GetTarget(res, gBmProperties[NOTE], true);
    if (!note) continue;
    note = note.QueryInterface(Components.interfaces.nsIRDFLiteral);
    if (!note) continue;
    note=note.Value;
    if (!note) {continue;}
    if (RDFCU.IsContainer(BMDS, res)) {continue;}
      
    try {var module = BMDS.GetTarget(res, gBmProperties[MODULE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
    if (module != aModule) continue;
    try {var chapter = BMDS.GetTarget(res, gBmProperties[CHAPTER], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}      
    if (usesVerseKey) {
      if (chapter != String(aChapter)) continue;
      try {var book = BMDS.GetTarget(res, gBmProperties[BOOK], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
      if (book != aBook) continue;
    }
    else {
      if (chapter != getUnicodePref("ShowingKey" + aModule)) continue;
      book = "na";
      chapter = "1";
    }
    try {var verse = BMDS.GetTarget(res, gBmProperties[VERSE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
    if (!BookmarkFuns.isItemChildOf(res,AllBookmarksRes,BMDS)) continue;
      
    // We have a keeper, lets save the note and show it in the text!
    // Encode ID
//dump ("FOUND ONE!:" + book + " " + chapter + " " + verse + " " + aModule + "\n");
    var encodedResVal = encodeUTF8(res.QueryInterface(kRDFRSCIID).Value);
    var myid = "un." + encodedResVal + "." + book + "." + chapter + "." + verse;
    var newNoteHTML = "<span id=\"" + myid + "\" class=\"un\" title=\"un\"></span>";
    var idname = (usesVerseKey ? "vs." + book + "." + chapter + ".":"par.");
    var verseStart = "id=\"" + idname + verse + "\">";
    // if this is a selected verse, place usernote inside the hilighted element (more like regular notes, so highlightSelectedVerses works right)
    var re = new RegExp(verseStart + "(\\s*<span.*?>)?", "im");
    usernotes.html = usernotes.html.replace(re, "$&" + newNoteHTML);
    usernotes.notes += myid + "<bg/>" + note + "<nx/>";
  }
  return usernotes;
}

function getNotesHTML(allNotes, version, showFootnotes, showCrossRefs, showUserNotes, openAllCrossReferences, frameNumber) {
  if (!allNotes) return "";
  if (!frameNumber) frameNumber = (guiDirection()=="rtl" ? prefs.getIntPref("NumDisplayedWindows"):1);
  
  //Start building notebox contents
  var haveNotes=false;
  var versionDirectionEntity = (VersionConfigs[version] && VersionConfigs[version].direction == "rtl" ? "&rlm;":"&lrm;");
  var orient = (VersionConfigs[version] && VersionConfigs[version].direction == "rtl" ? "fncol3RTL":"fncol3LTR");
  var t = "<div id=\"maintable.\" class=\"fntable\">";
  var note = allNotes.split("<nx/>");
  note = note.sort(ascendingVerse);
  if (note[0] != "") {
    var te = "";
    var thiscv="";
  checkfootnotes :
    // Now parse each note in the chapter separately
    for (var n=0; n < note.length; n++) {
      // note format is tp.n.Book.c.v<bg/>body
      var noteid = note[n].split("<bg/>")[0];
      var body   = note[n].split("<bg/>")[1];
      if (noteid && noteid != "undefined") {    // sometimes this is "undefined" - why?
        // Check if this note should be displayed at bottom, and if not then get next note
        var noteType = noteid.substr(0,2);
        var fn = ((noteType == "fn") && showFootnotes);
        var cr = ((noteType == "cr") && showCrossRefs);
        var un = ((noteType == "un") && showUserNotes);
        if (!(fn||cr||un)) {continue checkfootnotes;}
        haveNotes = true; 
        // Now display this note as a row in the main table
        t += "<div style=\"display:table-row;\">";
        
        // Write cell #1: an expander link for cross references only
        t += "<div class=\"fncol1\">";
        if (cr) {t += "<img id=\"exp." + noteid + "\" src=\"chrome://xulsword/skin/images/twisty-clsd.png\">";}
        t += "</div>";
        // These are the lines for showing expanded verse refs
        t += "<div id=\"exp2." + noteid + "\" class=\"fncol2\"><div class=\"fndash\"></div></div>";
        t += "<div id=\"exp3." + noteid + "\" class=\"fncol3 " + orient + "\" >&nbsp</div>";
        
        // This makes the following cells part of the highlight
        t += "<div id=\"ntr." + noteid + "\" class=\"normalNote\">";
        
        // Write cell #4: chapter and verse
        var tmp = noteid.match(/\.(\d+)\.(\d+)$/);
        var myc = tmp[1]
        var myv = tmp[2];
        t += "<a id=\"notl." + noteid + "\" class=\"fncol4 vstyle" + version + "\" >" + "<i>" + myc + ":" + versionDirectionEntity + myv + "</i>" + " -" + "</a>";
        
        // Write cell #5: note body
        t += "<div id=\"body." + noteid + "\" class=\"fncol5\">";
        // If this is a cross reference, then parse the note body for references and display them
        if (cr) t += getCRNoteHTML(version, "nb", noteid, body, "<br>", openAllCrossReferences, frameNumber);
        // If this is a footnote, then just write the body
        if (fn||un) {
          var userNoteIdentifierOpen  = "";
          var userNoteIdentifierClose = "";
          if (un) {
            var unclass = "noteBoxUserNote";
            var de = "&lrm;";
            try {
              var unmod = BMDS.GetTarget(RDF.GetResource(decodeUTF8(noteid.match(/un\.(.*?)\./)[1])), gBmProperties[NOTELOCALE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
              unclass += " vstyle" + unmod;
            }
            catch (er) {}
            try {
              if (LocaleConfigs[unmod].direction == "rtl") de = "&rlm;";
            }
            catch (er) {}
            userNoteIdentifierOpen  = "<span class=\"" + unclass + "\">" + de;
            userNoteIdentifierClose = de + "</span>";
          }
          // Replace OSIS <hi> tags with <i> or <b> as appropriate
          body = userNoteIdentifierOpen + noteBody2HTML(body, version) + userNoteIdentifierClose;
          t += body;
        }
        
        // Finish this body and this row
        t += "</div></div></div>";
      }
    }
    // End the main table
    t += "</div>";
  }
  if (!haveNotes) return "";
  return t
}

// converts hilights only for OSIS source right now
function noteBody2HTML(body, modName) {
  var bold = new RegExp("<hi [^>]*type=\"b[^\"]*\"[^>]*>", "g");
  var ital = new RegExp("<hi [^>]*type=\"i[^\"]*\"[^>]*>", "g");
  body = body.replace(bold, "X~LTspan style=\"font-weight:bold;\"X~GT");
  body = body.replace(ital, "X~LTspan style=\"font-style:italic;\"X~GT");
  body = body.replace(/<\/hi>/g, "X~LT/spanX~GT");
  body = body.replace(/<[^>*]>/, "");
  body = body.replace("X~LT", "<", "g");
  body = body.replace("X~GT", ">", "g");
  return body;
}

function getCRNoteHTML(version, id, xsID, xsNodeBody, sep, expanded, frameNumber) {
  var html = (expanded ? "":"<span style=\"line-height:2;\" class=\"vstyleProgram\" >");
  var versionDirectionEntity = (VersionConfigs[version] && VersionConfigs[version].direction == "rtl" ? "&rlm;":"&lrm;");
  var ref = xsNodeBody.split(";");
  var openSep="";
  var closedSep="";
  for (var r=0; r<ref.length; r++) {
    if (!ref[r]) continue;
    if (expanded) {
      var aDiv = getVerseTextDiv(version, ref[r], id, xsID, frameNumber);
      if (!aDiv) continue;
      html += openSep + aDiv;
      openSep = sep;
    }
    else {
      ref[r] = normalizeOsisReference(ref[r], version);
      if (!ref[r]) continue;
      html += closedSep + "<a id=\"" + id + "l." + xsID + "\" title=\"" + version + "." + ref[r] + "\" >" + ref2ProgramLocaleText(ref[r]) + "</a>";
      closedSep = "; ";
    }
  }
  html += (expanded ? "":"</span>");
  return html;
}

function getVerseTextDiv(origVers, origRef, id, xsID, hideEmptyCrossReferences, frameNumber) {
  origRef = normalizeOsisReference(origRef, origVers);
  if (!origRef) return "";
  var aVerse = findAVerseText(origVers, origRef, frameNumber);
  if (hideEmptyCrossReferences && aVerse.text.search(/\S/)==-1) return "";
  
  var textDirectionChar = (VersionConfigs[Tabs[aVerse.tabNum].modName] && VersionConfigs[Tabs[aVerse.tabNum].modName].direction == "rtl" ? "&rlm;":"&lrm;");
  
  var html = "";
  html += "<div class=\"vstyle" + Tabs[aVerse.tabNum].modName + "\">";
  html += "<a id=\"" + id + "l." + xsID + "\" title=\"" + Tabs[aVerse.tabNum].modName + "." + aVerse.location + "\" class=\"vstyleProgram\">" + ref2ProgramLocaleText(aVerse.location) + textDirectionChar + ":</a>";
  html += "<span id=\"" + id + "t." + xsID + "\" title=\"" + Tabs[aVerse.tabNum].modName + "." + aVerse.location + "\" class=\"vstyle" + Tabs[aVerse.tabNum].modName + "\"> ";
  html += aVerse.text + (origVers != Tabs[aVerse.tabNum].modName ? " (" + Tabs[aVerse.tabNum].label + ")":"");
  html += "</span><br>";
  html += "</div>"
  
  return html;
}

function ascendingVerse(a,b) {
  var res=null;
  var t1="un"; 
  var t2="fn"; 
  var t3="cr";
  if (a==null || a=="") return 1;
  if (b==null || b=="") return -1;
  var av = Number(a.match(/(\d+)\.(\d+)<bg\/>/)[2]);
  var bv = Number(b.match(/(\d+)\.(\d+)<bg\/>/)[2]);
  var ac = Number(a.match(/(\d+)\.(\d+)<bg\/>/)[1]);
  var bc = Number(b.match(/(\d+)\.(\d+)<bg\/>/)[1]);
  if (ac == bc) {
    if (av == bv) {
      var at = a.match(/^(\w\w)/)[1];
      var bt = b.match(/^(\w\w)/)[1];
      if (at == bt) return 0;
      if (at == t1) return -1;
      if (at == t2 && bt == t3) return -1;
      else return 1
    }
    return av > bv ? 1:-1
  }
  else if (ac < bc) return -1;
  return 1;
}

// Converts a short book reference into readable text in the locale language, and can handle from-to cases
// Possible inputs: bk.c.v[.lv][-bk.c.v[.lv]]
// Possible outputs:
//    bk c:v
//    bk c:v-lv
//    bk c:v-lv, bk c:v-lv
//    
function ref2ProgramLocaleText(reference) {
  var separator="";
  var dc = LocaleDirectionEntity;
  var retv=dc;
 
  reference += "-";
  var myrefs = reference.split("-");
  myrefs.pop();
  for (var ix=0; ix<myrefs.length; ix++) {
    // Some ref names returned by xulsword have a leading space!! Remove it first...
    myrefs[ix] = myrefs[ix].replace(/^\s*/,"");
    var myrefsP = myrefs[ix].split(".");
    if (myrefsP[2] && myrefsP[3] && myrefsP[2]==myrefsP[3]) {myrefsP.pop();}
    if (myrefsP.length == 4) {
      myrefsP[0] = Book[findBookNum(myrefsP[0])].bName;
      if (myrefsP[0]==null) {jsdump("WARNING: Didn't find ref >" + myrefs[ix] + "< in ref2ProgramLocaleText\n");}
      else {
        if (separator != "") {retv += dc + "-" + myrefsP[3];}
        else {retv += separator + myrefsP[0] + dc + " " + myrefsP[1] + ":" + dc + myrefsP[2] + dc + "-" + myrefsP[3];}
      }
      separator = ", ";
    }
    else if (myrefsP.length == 3) {
      var bn = findBookNum(myrefsP[0]);
      if (bn!=null) myrefsP[0] = Book[bn].bName;
      if (bn==null || myrefsP[0]==null) {jsdump("WARNING: Didn't find ref >" + myrefs[ix] + "< in ref2ProgramLocaleText\n");}
      else {
        if (separator != "") {retv += dc + "-" + myrefsP[2];}
        else {retv += separator + myrefsP[0] + dc + " " + myrefsP[1] + ":" + dc + myrefsP[2];}
      }
      separator = dc + " " + dc + "-" + dc + " ";
    }
  }
  return retv;
}

function getCopyright(module) {
  var copyr = Bible.getModuleInformation(module, "ShortCopyright");
  if (copyr==NOTFOUND) {
    copyr = (Tab[module] ? Tab[module].label + ": ":"");
    var cr2 = Bible.getModuleInformation(module, "DistributionLicense");
    if (cr2 != NOTFOUND) copyr += cr2;
  }
  return " " + copyr + " ";
}

