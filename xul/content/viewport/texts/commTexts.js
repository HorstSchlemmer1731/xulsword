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

////////////////////////////////////////////////////////////////////////
// CommTexts
////////////////////////////////////////////////////////////////////////

CommTexts = {
  
  read: function(w, d) {
    var ret = { htmlText:"", htmlNotes:"", htmlHead:Texts.getPageLinks(), footnotes:null };

    // For Pin feature, set "global" SWORD options for local context
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      LibSword.setGlobalOption(GlobalToggleCommands[cmd], d.globalOptions[GlobalToggleCommands[cmd]]);
    }
    
    // get Commentary chapter's text
    ret.htmlText = LibSword.getChapterText(d.mod, d.bk + "." + d.ch + ".1.1");   
    ret.footnotes = LibSword.getNotes();
     
    var un;
    if (d.globalOptions["User Notes"] == "On") {
      un = Texts.getUserNotes(d.bk, d.ch, d.mod, ret.htmlText);
      ret.htmlText = un.html; // has user notes added to text
      ret.footnotes += un.notes;
    }
    
   // handle footnotes
    var gfn = (d.globalOptions["Footnotes"] == "On" && d["ShowFootnotesAtBottom"]);
    var gcr = (d.globalOptions["Cross-references"] == "On" && d["ShowCrossrefsAtBottom"]);
    var gun = (d.globalOptions["User Notes"] == "On" && d["ShowUserNotesAtBottom"]);
      
    if (gfn || gcr || gun) ret.htmlNotes = BibleTexts.getNotesHTML(ret.footnotes, d.mod, gfn, gcr, gun, false, w, false);
    
    // localize verse numbers
    var tl = ModuleConfigs[d.mod].AssociatedLocale;
    if (tl == NOTFOUND) {tl = getLocale();}
    var verseNm = new RegExp("(<sup class=\"versenum\">)(\\d+)(</sup>)", "g");
    ret.htmlText = ret.htmlText.replace(verseNm, function(str, p1, p2, p3) {return p1 + dString(p2, tl) + p3;});

    // add headers
    var showHeader = (d.globalOptions["Headings"] == "On");
    if (showHeader && ret.htmlText) {
      ret.htmlText = BibleTexts.getChapterHeading(d) + ret.htmlText;
    }
    
    // put "global" SWORD options back to their global context values
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      LibSword.setGlobalOption(GlobalToggleCommands[cmd], prefs.getCharPref(GlobalToggleCommands[cmd]));
    }
    
    return ret;
  }
  
};

