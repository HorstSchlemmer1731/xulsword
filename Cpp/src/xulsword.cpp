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

#ifdef _WIN32
  #include "windows.h"
#else
  #include "config.h"
#endif

#include <dirent.h>
#include <stdio.h>
#include <string>
#include <iostream>

#include "xulsword.h"
#include "strkey.h"
#include "swmodule.h"
#include "swlog.h"
#include "osisxhtml.h"
#include "gbfxhtml.h"
#include "thmlxhtml.h"

#include "canon_synodal0.h"	// Russian Synodal sword-1.6.1 v11n system
#include "canon_east.h"
#include "canon_synodalprot.h"
#include "osisdictionary.h"
#include "versemaps.h"

#define MAXSTRING 1000
#define MAXDICTSIZE 20000 /*ISBE is 9350 entries*/
#define MODVERSION "xulswordVersion"
#define NOTFOUND "Not Found"
#define WESTERN "KJV"
#define EASTERN "EASTERN" // DEPRICATED verse system used by pre sword-1.6.1 built modules
#define SYNODAL "Synodal"  // can be used by strstr to match SynodalProt, SynodalP, Synodal0, and Synodal
#define VSERROR 99
#define MAXINSTANCE 10;

#ifdef WIN32
#define DLLEXPORT extern "C" __declspec(dllexport)
#else
#define DLLEXPORT extern "C"
#endif

#ifndef PHPSWORD
#define emalloc malloc
#else
extern "C" {
#include "php.h"
}
#endif


const char DefaultVersificationSystem[] = "KJV";

void savePercentComplete(char percent, void *userData) {
  if (userData) {
    void (*funcptr)(int) = (void (*)(int))userData;
    funcptr((int)percent);
  }
}
  

/********************************************************************
Custom derivative classes
*********************************************************************/
#include "osisxhtmlxs.cpp"
#include "gbfxhtmlxs.cpp"
#include "thmlxhtmlxs.cpp"
#include "osisdictionary.cpp"

using namespace sword;


/********************************************************************
xsThrow
*********************************************************************/
void xulsword::xsThrow(const char *msg) {
  if (ThrowJS) {ThrowJS(msg);}
}


/********************************************************************
keyToVars
*********************************************************************/
// Assign a set of verse locations from a key
void xulsword::keyToVars(VerseKey *key, SWBuf *chapter, int *verse, int *lastverse) {
  chapter->setFormatted("%s %i", key->getBookAbbrev(), key->getChapter());
  *verse = key->getVerse();
  if (key->isBoundSet()) {*lastverse = key->UpperBound().getVerse();}
  else {*lastverse = key->getVerse();}
}


/********************************************************************
getVerseSystemOfModule
*********************************************************************/
// Returns DefaultVersificationSystem if verse system cannot be determined.
const char *xulsword::getVerseSystemOfModule(const char * mod) {
  if (!mod || !strcmp(mod, "KJV")) return DefaultVersificationSystem;
  SWModule * module = MyManager->getModule(mod);
  if (!module) {return DefaultVersificationSystem;}
  VerseKey *vkey;
  vkey = SWDYNAMIC_CAST(VerseKey, module->getKey());

  // Some dictionaries also have Versification specified (for verse references)
  if (!vkey) {
    ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&module->getConfig());
    ConfigEntMap::iterator it = infoConfig->find("Versification");
    if (it != infoConfig->end()) {return it->second.c_str();}
    else {return DefaultVersificationSystem;}
  }

  return vkey->getVersificationSystem();
}


/********************************************************************
locationToVerseKey
*********************************************************************/
/*  Reads a xulsword reference and sets the versekey text and upper bounds
    xulsword references never cross chapter boundaries and can have these forms:
      shortBook chapterNumber (in this case Verse=1 and LastVerse=maxverse)
      shortBook.chapterNumber (in this case Verse=1 and LastVerse=maxverse)
      shortBook chapterNumber:verseNumber
      shortBook chapterNumber:verseNumber - lastVerseNumber
      shortBook chapterNumber:verseNumber - shortBook chapterNumber:lastVerseNumber
      shortBook.chapterNumber.verseNumber.lastVerseNumber
      shortBook.chapterNumber.verseNumber
*/
int xulsword::locationToVerseKey(const char *locationText, VerseKey *vk) {
  int firstverse=0;
  int lastverse=0;
  vk->ClearBounds(); // important to prevent errors after setText
  VerseKey ub;
  std::string keytext = locationText;
  int dash = keytext.find('-',0);
  if (dash != std::string::npos) {
    std::string upperbound;
    upperbound.assign(keytext, dash+1, keytext.length()-dash-1);
    keytext.assign(keytext, 0, dash);
    lastverse = atoi(upperbound.c_str());
    // test for anything other than just a last verse number
    if (lastverse < 1 || upperbound.length() > 3) {
      ub.setVersificationSystem(vk->getVersificationSystem());
      locationToVerseKey(upperbound.c_str(), &ub);
      lastverse = ub.getVerse();
    }
  }
  else {
    // If there is no dash, look for a "." delineated lastverse location (The "last verse"
    // position is unique to xulsword and so if it exists, it needs to be parsed here before handing to verse key.)
    lastverse = 0;
    unsigned int p=0;
    for (int i=0; i<3; i++) {
      p = keytext.find('.',p);
      if (p == std::string::npos) {break;}
      p++;
    }
    // less than three "."s
    if (p == std::string::npos) {
      // check if no verse, and if not, then first verse is 1 and lastverse is maxverse
      p = keytext.find_first_not_of(" ", 0); // allow for leading spaces
      for (int i=0; i<2; i++) {
        p = keytext.find_first_of(" :.", p);
        if (p == std::string::npos) {break;}
        p++;
      }
      // if less than two delimiters were found, or no number following second delimiter = no verse
      if (p == std::string::npos || atoi(keytext.substr(p).c_str()) == 0) {
        firstverse = 1;
        lastverse = 200; //ends up as maxverse
      }
    }
    // three "."s
    else {
      lastverse = atoi(keytext.substr(p).c_str());
      keytext.assign(keytext, 0, p-1);
    }
  }

  vk->setText(keytext.c_str());
  if (vk->getChapter() < 1) {vk->setChapter(1);}
  if (vk->getVerse() < 1) {vk->setVerse(1);}
//printf("set=%s, actual=%s\n", keytext.c_str(), vk->getText());
  ub.copyFrom(vk);
  if (lastverse < ub.getVerse()) {lastverse = ub.getVerse();}
  else if (lastverse > ub.getVerseMax()) {lastverse = ub.getVerseMax();}
  ub.setVerse(lastverse);
  vk->UpperBound(ub);
  return (vk->Error());
}


/********************************************************************
textToMaxChapter
*********************************************************************/
// Takes vkeytext and versification, and returns max chapter, plus inits vkey to vkeytext (with vmax).
int xulsword::textToMaxChapter(const char *vkeytext, VerseKey *vkey) {
  locationToVerseKey(vkeytext, vkey);
  return vkey->getChapterMax();
}


/********************************************************************
textToMaxVerse
*********************************************************************/
// Takes vkeytext and versification, and returns max verse of chapter, plus inits vkey to vkeytext (with vmax).
int xulsword::textToMaxVerse(const char *vkeytext, VerseKey *vkey) {
  locationToVerseKey(vkeytext, vkey);
  return vkey->getVerseMax();
}


/********************************************************************
getFolderContents
*********************************************************************/
#define ROOTRDF "http://www.xulsword.com/tableofcontents/ContentsRoot"
void xulsword::getFolderContents(TreeKey *key, const char *modname, SWBuf *retval) {
  retval->setFormatted("\t<RDF:Seq RDF:about=\"rdf:#/%s%s\">\n", modname, key->getText());

  SWBuf subfolders;
  SWBuf descriptions;

  bool ok;
  bool isChild=false;
  for (ok = key->firstChild(); ok; ok = key->nextSibling()) {
    isChild=true;
    retval->appendFormatted("\t\t<RDF:li RDF:resource=\"rdf:#/%s%s\" />\n", modname, key->getText());

    descriptions.appendFormatted("\t<RDF:Description RDF:about=\"rdf:#/%s%s\" \n\t\t\tTABLEOFCONTENTS:Chapter=\"rdf:#/%s%s\" \n\t\t\tTABLEOFCONTENTS:Type=\"%s\" \n\t\t\tTABLEOFCONTENTS:Name=\"%s\" />\n",
          modname,
          key->getText(),
          modname,
          key->getText(),
          (key->hasChildren() ? "folder":"key"),
          key->getLocalName());

    if (key->hasChildren()) {
      SWBuf save = key->getLocalName();
      SWBuf subf;
      getFolderContents(key, modname, &subf);
      subfolders.append(subf);
      key->setLocalName(save);
    }
  }
  if (isChild) {key->parent();}

  retval->append("\t</RDF:Seq>\n\n");
  retval->append(descriptions.c_str());
  retval->append(subfolders.c_str());
}


/********************************************************************
updateGlobalOptions
*********************************************************************/
void xulsword::updateGlobalOptions(bool disableFootCrossRed) {
  MyManager->setGlobalOption("Headings",Headings ? "On":"Off");
  MyManager->setGlobalOption("Footnotes",Footnotes && !disableFootCrossRed ? "On":"Off");
  MyManager->setGlobalOption("Cross-references",Crossrefs && !disableFootCrossRed ? "On":"Off");
  MyManager->setGlobalOption("Dictionary",Dictionary ? "On":"Off");
  MyManager->setGlobalOption("Words of Christ in Red",Redwords && !disableFootCrossRed ? "On":"Off");
  MyManager->setGlobalOption("Hebrew Vowel Points",HebrewPoints ? "On":"Off");
  MyManager->setGlobalOption("Hebrew Cantillation",Cantillation ? "On":"Off");
  MyManager->setGlobalOption("Strong's Numbers",Strongs ? "On":"Off");
  MyManager->setGlobalOption("Morphological Tags",Morph ? "On":"Off");
  MyManager->setGlobalOption("Morpheme Segmentation",MorphSeg ? "On":"Off");
}


/********************************************************************
mapVersifications
*********************************************************************/
// Reads an input key and sets the output key to the same verse in opposing verse system.
// Conversion is always between WESTERN (KJV) and EASTERN (Synodal, Synodal0, SynodalP, SynodalProt etc).
// If upper bound is set on input key, then converted upper bound will be set on output key
void xulsword::mapVersifications(VerseKey *vkin, VerseKey *vkout) {
  const char *inVerseSystem = vkin->getVersificationSystem();
  const char *outVerseSystem = vkout->getVersificationSystem();

  // only change output key's verse system when it's necessary
  if (!strcmp(inVerseSystem,EASTERN) || strstr(inVerseSystem,SYNODAL)) vkout->setVersificationSystem(WESTERN);
  else if (!strcmp(inVerseSystem,WESTERN) && (strcmp(outVerseSystem,EASTERN) && !strstr(outVerseSystem,SYNODAL)))
    vkout->setVersificationSystem(EASTERN);

  vkout->ClearBounds(); // important to prevent errors which changing key!

  // Prepare to map UpperBound
  SWBuf keyTextU;
  VerseKey bkey;
  if (vkin->isBoundSet()) {
    keyTextU.appendFormatted("%s %i:%i", vkin->UpperBound().getBookAbbrev(), vkin->UpperBound().getChapter(), vkin->UpperBound().getVerse());
    bkey.setVersificationSystem(!strcmp(inVerseSystem, WESTERN) ? EASTERN:WESTERN);
    bkey.setText(keyTextU.c_str());
  }

  // Prepare to map key
  SWBuf keyText;
  keyText.appendFormatted("%s %i:%i", vkin->getBookAbbrev(), vkin->getChapter(), vkin->getVerse());
  vkout->setText(keyText.c_str());

  // Map key and bounds
  // Note: this loop needs to complete (no "break"ing) to insure conversion is done properly!
  for (int i=0; i < MAPLEN; i++) {
    const char * mf;
    const char * mt;
    if ((!strcmp(inVerseSystem, WESTERN))) {mf = West2EastMap[i].west; mt = West2EastMap[i].east;}
    else                                   {mf = West2EastMap[i].east; mt = West2EastMap[i].west;}
    if (vkin->isBoundSet() && !strcmp(keyTextU.c_str(), mf)) {bkey.setText(mt);}
    if (!strcmp(keyText.c_str(), mf)) {vkout->setText(mt);}
  }
  if (vkin->isBoundSet()) {vkout->UpperBound(bkey);}
}


/********************************************************************
getBookName
*********************************************************************/
char *xulsword::getBookName(SWBuf *Chapter) {
  std::string chapter;
  std::string book;

  chapter.assign(Chapter->c_str());

  int space = chapter.find(' ',0);
  book.assign(chapter.substr(0,space));

  char *retval;
  retval = (char *)malloc(book.length() + 1);
  if (retval) {strcpy(retval, book.c_str());}

  return retval;
}


/********************************************************************
PUBLIC XULSWORD FUNCTIONS
*********************************************************************/

xulsword::xulsword(char *path, char *(*toUpperCase)(char *), void (*throwJS)(const char *), void (*reportProgress)(int)) {
  MyLog = new SWLogXS();
  SWLog::setSystemLog(MyLog);
  SWLog::getSystemLog()->setLogLevel(5); // set SWORD log reporting... 5 is all stuff
  SWLog::getSystemLog()->logDebug("XULSWORD CONSTRUCTOR");
  ToUpperCase = (toUpperCase ? toUpperCase:NULL);
  ThrowJS = (throwJS ? throwJS:NULL);
  ReportProgress = (reportProgress ? reportProgress:NULL);

  MyMarkupFilterMgr = new MarkupFilterMgrXS();

  MyManager = new SWMgrXS(path, false, (MarkupFilterMgr *)MyMarkupFilterMgr, true, true);
  
  MyVerseMgr = VerseMgr::getSystemVerseMgr();
  MyVerseMgr->registerVersificationSystem("Synodal0", otbooks_synodal0, ntbooks_synodal0, vm_synodal0);
  MyVerseMgr->registerVersificationSystem("EASTERN", otbooks_eastern, ntbooks_eastern, vm_eastern);
  MyVerseMgr->registerVersificationSystem("SynodalProt", otbooks_synodalprot, ntbooks_synodalprot, vm_synodalprot);
  
  MyManager->Load();

  if (ToUpperCase) {
    MyStringMgrXS = new StringMgrXS(ToUpperCase);
    StringMgr::setSystemStringMgr(MyStringMgrXS);
  }
}

xulsword::~xulsword() {
  //delete(MyLog); deleted by _staticSystemLog
  //delete(MyStringMgrXS); deleted by _staticsystemStringMgr
  if (MyManager) {delete(MyManager);}
  //delete(MyMarkupFilterMgr); deleted by SWMgr
}


/********************************************************************
GetChapterText
*********************************************************************/
char *xulsword::getChapterText(const char *vkeymod, const char *vkeytext) {
  SWBuf verseText;
  SWBuf footnoteText;
  SWBuf crossRefText;
  SWBuf noteText;
  SWBuf Chapter;
  int Verse;
  int LastVerse;
  
  SWModule * module = MyManager->getModule(vkeymod);
  if (!module) {
    xsThrow("GetChapterText: module not found.");
    return NULL;
  }

  SWKey *testkey = module->CreateKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!myVerseKey) {
    delete(testkey);
    xsThrow("GetChapterText: module was not Bible or Commentary.");
  }

  myVerseKey->Persist(1);
  myVerseKey->setAutoNormalize(0); // Non-existant calls should return empty string
  module->setKey(myVerseKey);

  locationToVerseKey(vkeytext, myVerseKey);
  keyToVars(myVerseKey, &Chapter, &Verse, &LastVerse);

  updateGlobalOptions(false);
  module->setSkipConsecutiveLinks(true);

  //Initialize Key to chapter
  myVerseKey->setText(Chapter.c_str());

  VerseKey ub;
  ub.copyFrom(myVerseKey);
  ub.setVerse(ub.getVerseMax());
  myVerseKey->UpperBound(ub);

  //Is this a Commentary??
  bool isCommentary = !strcmp(module->Type(), "Commentaries");

  //NOW READ ALL VERSES IN THE CHAPTER

  char *bkp = getBookName(&Chapter);
  SWBuf bk;
  bk.set(bkp);
  delete(bkp);

  int ch = myVerseKey->getChapter();

  bool haveText = false;
  std::string chapHTML;

  while (!module->Error()) {
    SWBuf verseHTML;
    int vNum = myVerseKey->getVerse();
    if (vNum>1 && vNum == Verse) {MyManager->setGlobalOption("Words of Christ in Red","Off");}
    else if (vNum == (LastVerse + 1)) {MyManager->setGlobalOption("Words of Christ in Red", Redwords ? "On":"Off");}
    verseText = module->RenderText(); //THIS MUST BE RENDERED BEFORE READING getEntryAttributes!!!

    // move verse number after any paragraph indents
    bool verseStartsWithIndent = false;
    if (!strncmp(verseText.c_str(),"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;",30)) {
      verseStartsWithIndent = true;
      verseText << 30;
    }
    haveText = haveText || *verseText.c_str();


    //SAVE ANY FOOTNOTES
    int fnV = 1;
    AttributeList::iterator AtIndex;
    for (AtIndex = module->getEntryAttributes()["Footnote"].begin(); AtIndex != module->getEntryAttributes()["Footnote"].end(); AtIndex++) {
      if ((AtIndex->second["type"] == "crossReference")||(AtIndex->second["type"] == "x-cross-ref")) {
          sprintf(Outtext, "cr.%d.%s<bg>", fnV, myVerseKey->getOSISRef());
          crossRefText.append(Outtext);
          crossRefText.append(AtIndex->second["refList"]);
          crossRefText.append("<nx>");
          noteText.append(Outtext);
          noteText.append(AtIndex->second["refList"]);
          noteText.append("<nx>");
        }
        else {
          sprintf(Outtext, "fn.%d.%s<bg>", fnV, myVerseKey->getOSISRef());
          footnoteText.append(Outtext);
          footnoteText.append(module->RenderText(AtIndex->second["body"]));
          footnoteText.append("<nx>");
          noteText.append(Outtext);
          noteText.append(module->RenderText(AtIndex->second["body"]));
          noteText.append("<nx>");
        }
      fnV++;
    }

    //FIRST PRINT OUT ANY HEADINGS IN THE VERSE
    AttributeValue::iterator Value;
    for (Value = module->getEntryAttributes()["Heading"]["Preverse"].begin(); Value != module->getEntryAttributes()["Heading"]["Preverse"].end(); Value++) {
      // if a line break is not found at or near the end of the previous verse,
      // add a line break to help insure titles have space above them.
      if (!verseHTML.length() && chapHTML.length() > 64) {
        int lbr = chapHTML.rfind("<br />");
        if (lbr != std::string::npos && chapHTML.length()-1-lbr < 64) verseHTML.append("<br />");
      }
      verseHTML.append("<div class=\"");
      if (module->getEntryAttributes()["Heading"][Value->first]["level"] && !strcmp(module->getEntryAttributes()["Heading"][Value->first]["level"], "2")) {
        verseHTML.append("head2");
      }
      else {verseHTML.append("head1");}
      if (module->getEntryAttributes()["Heading"][Value->first]["canonical"] && !strcmp(module->getEntryAttributes()["Heading"][Value->first]["canonical"], "true")) {
        verseHTML.append(" canonical");
      }
      verseHTML.append("\">");
      verseHTML.append(module->RenderText(Value->second));
      verseHTML.append("</div>");
    }

    //NOW PRINT OUT THE VERSE ITSELF
    //If this is selected verse then designate as so
    //Output verse html code
    sprintf(Outtext, "<span id=\"vs.%s.%d.%d\">", bk.c_str(), ch, vNum);
    verseHTML.append(Outtext);

    if (Verse > 1) {
      if (vNum==Verse) {verseHTML.append("<span id=\"sv\" class=\"hl\">");}
      else if ((vNum > Verse)&&(vNum <= LastVerse)) {verseHTML.append("<span class=\"hl\">");}
    }
    
    if (verseStartsWithIndent) {verseHTML.append("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;");}

    verseHTML.append("<sup class=\"versenum\">");
    //If verse is non-empty and verse numbers are being displayed then print the verse number
    if (Versenumbers && (verseText.length() > 0)) {
      sprintf(Outtext, "%d", vNum);
      verseHTML.append(Outtext);
      verseHTML.append("</sup>");
    }
    else {verseHTML.append("</sup> ");}

    verseHTML.append(verseText.c_str());
    if (isCommentary) {verseHTML.append("<br><br>");}

    if (Verse > 1) {
      if(vNum==Verse) {verseHTML.append("</span>");}
      else if ((vNum > Verse)&&(vNum <= LastVerse)) {verseHTML.append("</span>");}
    }
    
    verseHTML.append("</span>");
    chapHTML.append(verseHTML.c_str());
    module->increment(1);
  }
  module->setKey(EmptyKey);

  if (!haveText) {chapHTML.assign("");}
  MyFootnotes = footnoteText;
  MyCrossRefs = crossRefText;
  MyNotes = noteText;
  
  delete(testkey);
  
  char *retval;
  retval = (char *)emalloc(chapHTML.length() + 1);
  if (retval) {strcpy(retval, chapHTML.c_str());}
  return retval;
}


/********************************************************************
GetFootnotes
*********************************************************************/
char *xulsword::getFootnotes() {
  //NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED
  char *retval;
  retval = (char *)emalloc(MyFootnotes.length() + 1);
  if (retval) {strcpy(retval, MyFootnotes.c_str());}
	return retval;
}


/********************************************************************
GetCrossRefs
*********************************************************************/
char *xulsword::getCrossRefs() {
  //NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED

  char *retval;
  retval = (char *)emalloc(MyCrossRefs.length() + 1);
  if (retval) {strcpy(retval, MyCrossRefs.c_str());}
	return retval;
}


/********************************************************************
GetNotes
*********************************************************************/
char *xulsword::getNotes() {
  //NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED

  char *retval;
  retval = (char *)emalloc(MyNotes.length() + 1);
  if (retval) {strcpy(retval, MyNotes.c_str());}
	return retval;
}


/********************************************************************
GetChapterTextMulti
*********************************************************************/
char *xulsword::getChapterTextMulti(const char *vkeymodlist, const char *vkeytext)
{
  SWBuf Chapter;
  int Verse;
  int LastVerse;
  
  updateGlobalOptions(true);
  MyManager->setGlobalOption("Words of Christ in Red","Off"); // Words of Christ in Red is off for multidisplay

  std::string modstr;
  modstr.assign(vkeymodlist);
  int comma = modstr.find(',',0);
  std::string thismod;
  thismod.assign(modstr.substr(0,comma));
  if (comma == std::string::npos) {
    xsThrow("GetChapterTextMulti: module list does not have form 'mod1,mod2,...'.");
    return NULL;
  }

  SWModule *module = MyManager->getModule(thismod.c_str());
  if (!module) {
    xsThrow("GetChapterTextMulti: module not found.");
    return NULL;
  }

  SWKey *testkey1 =  module->CreateKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey1);
  if (!myVerseKey) {
    delete(testkey1);
    xsThrow("GetChapterTextMulti: module is not Bible or Commentary'.");
    return NULL;
  }
  
  locationToVerseKey(vkeytext, myVerseKey);
  keyToVars(myVerseKey, &Chapter, &Verse, &LastVerse);
  myVerseKey->setText(Chapter.c_str());

  VerseKey ub;
  ub.copyFrom(myVerseKey);
  ub.setVerse(ub.getVerseMax());
  myVerseKey->UpperBound(ub);

/*
  <div class="interB>

    [<span class="hl" [id="sv"]>]
    <div class="interV1">
      <sup class="versnum">5</sup>
      <span id="vs.5.1">Some verse text from module 1.</span>
    </div>

    <div class="interS"></div>

    <div class="interV2">
      <sup class="versnum">5</sup>
      <span id="vs.5.2">Some verse text from module 2.</span>
    </div>
    [</span>]

  </div>
*/

  //NOW READ ALL VERSES IN THE CHAPTER
  char *bkp = getBookName(&Chapter);
  SWBuf bk;
  bk.set(bkp);
  delete(bkp);

  SWBuf chapText;
  SWModule *versemod;
  bool haveText = false;
  while (!myVerseKey->Error()) {
    int vNum = myVerseKey->getVerse();

    // Each verse group has its own div with a class
    chapText.append("<div class=\"interB\">");

    //If this is the selected verse group then designate as so
    if (Verse > 1) {
      if(vNum==Verse) {chapText.append("<span id=\"sv\" class=\"hl\">");}
      else if ((vNum > Verse)&&(vNum <= LastVerse)) {chapText.append("<span class=\"hl\">");}
    }
    
    int versionNum = 1;
    modstr.assign(vkeymodlist);
    do {
      // each version is separated by a separator that has a class
      if (versionNum > 1) {chapText.append("<div class=\"interS\"></div>");}

      // each version has its own unique class ID
      chapText.appendFormatted("<div class=\"interV%d\"><sup class=\"versenum\">", versionNum);
      if (Versenumbers) {chapText.appendFormatted("%d",vNum);}
      chapText.appendFormatted("</sup><span id=\"vs.%s.%d.%d.%d\">", bk.c_str(), myVerseKey->getChapter(), vNum, versionNum++);

      comma = modstr.find(',',0);
      thismod.assign(modstr.substr(0,comma));
      if (comma != std::string::npos) {modstr.assign(modstr.substr(comma+1));}

      versemod = MyManager->getModule(thismod.c_str());
      if (!versemod) {break;}

      SWKey *testkey2 = versemod->CreateKey();
      VerseKey *mainkey = SWDYNAMIC_CAST(VerseKey, testkey2);
      if (!mainkey) {
        delete(testkey2);
        break;
      }
      const char * toVS = mainkey->getVersificationSystem();
      delete(testkey2);

      VerseKey readKey;
      readKey.copyFrom(myVerseKey);
      readKey.setAutoNormalize(0); // Non-existant calls should return empty string!
      const char * frVS = readKey.getVersificationSystem();
      if ((!strcmp(frVS,WESTERN) && (!strcmp(toVS,EASTERN) || strstr(toVS,SYNODAL))) ||
          (!strcmp(toVS,WESTERN) && (!strcmp(frVS,EASTERN) || strstr(frVS,SYNODAL)))) {
        VerseKey convertKey;
        convertKey.copyFrom(readKey);
        readKey.setVersificationSystem(toVS);
        mapVersifications(&convertKey, &readKey);
      }
      versemod->SetKey(readKey);

      SWBuf tmp;
      if (!versemod->Error()) {tmp.set(versemod->RenderText());}
      chapText.append(tmp);
      haveText = haveText || tmp.c_str();

      chapText.append("</span></div>");
    } while (comma != std::string::npos);

    if (Verse > 1) {
      if (vNum==Verse) {chapText.append("</span>");}
      else if ((vNum > Verse)&&(vNum <= LastVerse)) {chapText.append("</span>");}
    }
    chapText.append("</div>");

    myVerseKey->increment(1);
  }

  if (!haveText) {chapText.set("");}

  // Return Words of Christ in Red feature to original value
  MyManager->setGlobalOption("Words of Christ in Red", Redwords ? "On":"Off");

  delete(testkey1);
  
  char *retval;
  retval = (char *)emalloc(chapText.length() + 1);
  if (retval) {strcpy(retval, chapText.c_str());}
	return retval;
}


/********************************************************************
GetVerseText
*********************************************************************/
char *xulsword::getVerseText(const char *vkeymod, const char *vkeytext) {
  SWModule * module = MyManager->getModule(vkeymod);
  if (!module) {
    xsThrow("GetVerseText: module not found.");
    return NULL;
  }

  SWKey *testkey = module->CreateKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!myVerseKey) {
    delete(testkey);
    xsThrow("GetVerseText: module is not a Bible or Commentary.");
    return NULL;
  }
  myVerseKey->Persist(1);
  module->setKey(myVerseKey);

  MyManager->setGlobalOption("Headings","Off");
  MyManager->setGlobalOption("Footnotes","Off");
  MyManager->setGlobalOption("Cross-references","Off");
  MyManager->setGlobalOption("Dictionary","Off");
  MyManager->setGlobalOption("Words of Christ in Red","Off");
  MyManager->setGlobalOption("Strong's Numbers","Off");
  MyManager->setGlobalOption("Morphological Tags","Off");
  MyManager->setGlobalOption("Morpheme Segmentation","Off");

  SWBuf bText;

  locationToVerseKey(vkeytext, myVerseKey);
  int numverses = 176; // set to max verses of any chapter
  while (!myVerseKey->Error())
  {
    SWBuf vtext = module->StripText();
    const char * vt = vtext.c_str();
    bool printChars = false;
    // trim() locks up if string is only white space! (sword 1.5.9)
    for (const char * vt = vtext.c_str(); *vt; vt++) {
      if (strchr("\t\r\n ", *vt)==NULL) {printChars=true; break;}
    }
    if (printChars) {
      vtext.trim();
      bText.append(vtext.c_str());
      bText.append(" ");
    }
    myVerseKey->increment(1);
    if (--numverses == 0) {break;}
  }
  module->setKey(EmptyKey);

  delete(testkey);
  
  char *retval;
  retval = (char *)emalloc(bText.length() + 1);
  if (retval) {strcpy(retval, bText.c_str());}
	return retval;
}


/********************************************************************
GetMaxChapter
*********************************************************************/
int xulsword::getMaxChapter(const char *mod, const char *vkeytext) {
  VerseKey vkey;
  vkey.setVersificationSystem(getVerseSystemOfModule(mod));
  return textToMaxChapter(vkeytext, &vkey);
}


/********************************************************************
GetMaxVerse
*********************************************************************/
int xulsword::getMaxVerse(const char *mod, const char *vkeytext) {
  VerseKey vkey;
  vkey.setVersificationSystem(getVerseSystemOfModule(mod));
  return textToMaxVerse(vkeytext, &vkey);
}


/********************************************************************
GetVerseSystem
*********************************************************************/
char *xulsword::getVerseSystem(const char *mod) {
  SWBuf vsystem;
  vsystem.set(getVerseSystemOfModule(mod));
  char *retval;
  retval = (char *)emalloc(vsystem.length() + 1);
  if (retval) {strcpy(retval, vsystem.c_str());}
	return retval;
}


/********************************************************************
ConvertLocation
*********************************************************************/
char *xulsword::convertLocation(const char *frVS, const char *vkeytext, const char *toVS) {
  VerseKey fromKey;
  fromKey.setVersificationSystem(frVS);
  locationToVerseKey(vkeytext, &fromKey);
//printf("FROM- KT:%s, LB:%s, UB:%s\n", fromKey.getShortText(), fromKey.LowerBound().getShortText(), fromKey.UpperBound().getShortText());

  SWBuf result;
  if ((!strcmp(frVS,WESTERN) && (!strcmp(toVS,EASTERN) || strstr(toVS,SYNODAL))) ||
      (!strcmp(toVS,WESTERN) && (!strcmp(frVS,EASTERN) || strstr(frVS,SYNODAL)))) {
    VerseKey toKey;
    toKey.setVersificationSystem(EASTERN); // init value only, may be changed by mapVersifications
    mapVersifications(&fromKey, &toKey);
//printf("TO  - KT:%s, LB:%s, UB:%s\n", toKey.getShortText(), toKey.LowerBound().getShortText(), toKey.UpperBound().getShortText());
    result.appendFormatted("%s.%i", toKey.getOSISRef(), toKey.UpperBound().getVerse());
  }
  else {
    result.appendFormatted("%s.%i", fromKey.getOSISRef(), fromKey.UpperBound().getVerse());
  }

  char *retval;
  retval = (char *)emalloc(result.length() + 1);
  if (retval) {strcpy(retval, result.c_str());}
	return retval;
}


/********************************************************************
GetBookIntroduction
*********************************************************************/
char *xulsword::getBookIntroduction(const char *vkeymod, const char *bname) {
  SWModule * module = MyManager->getModule(vkeymod);
  if (!module) {
    xsThrow("GetBookIntroduction: module not found.");
    return NULL;
  }

  SWKey *testkey = module->CreateKey();
  VerseKey *introkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!introkey) {
    delete(testkey);
    xsThrow("GetBookIntroduction: module is not a Bible or Commentary.");
    return NULL;
  }

  updateGlobalOptions(false);

  introkey->Headings(1);
  introkey->setAutoNormalize(false); // IMPORTANT!! Otherwise, introductions are skipped!
  introkey->setText(bname);
  introkey->setChapter(0);
  introkey->setVerse(0);
  introkey->Persist(1);
  module->setKey(introkey);

  SWBuf intro;
  intro.set(module->RenderText());
  
  module->setKey(EmptyKey);
  delete(testkey);

  char *retval;
  retval = (char *)emalloc(intro.length() + 1);
  if (retval) {strcpy(retval, intro.c_str());}
	return retval;
}


/********************************************************************
GetDictionaryEntry
*********************************************************************/
char *xulsword::getDictionaryEntry(const char *lexdictmod, const char *key) {
  updateGlobalOptions(false);

  SWModule *dmod;
  dmod = MyManager->getModule(lexdictmod);
  if (!dmod) {
    xsThrow("GetDictionaryEntry: module not found.");
    return NULL;
  }

  SWKey *tkey = dmod->CreateKey();
  if (!SWDYNAMIC_CAST(StrKey, tkey)) {
    delete(tkey);
    xsThrow("GetDictionaryEntry: module is not a Dictionary.");
    return NULL;
  }
  delete(tkey);

  SWBuf xstring;
  dmod->setKey(key);

  dmod->increment(0); // Refresh the key's location

  if (strcmp(dmod->getKeyText(), key)) {xstring.set("");}
  else {
    xstring.set(dmod->RenderText());
    //Now add any footnotes
    int footnoteNum = 1;
    AttributeList::iterator AtIndex;
    for (AtIndex = dmod->getEntryAttributes()["Footnote"].begin(); AtIndex != dmod->getEntryAttributes()["Footnote"].end(); AtIndex++) {
      if (footnoteNum == 1) {xstring.append("<br><br><br><hr>");}
      xstring.appendFormatted("<sup>%i</sup>", footnoteNum++);
      xstring.append(dmod->RenderText(AtIndex->second["body"]));
      xstring.append("<br><br>");
    }
  }

  char *retval;
  retval = (char *)emalloc(xstring.length() + 1);
  if (retval) {strcpy(retval, xstring.c_str());}
	return retval;
}


/********************************************************************
GetAllDictionaryKeys
*********************************************************************/
char *xulsword::getAllDictionaryKeys(const char *lexdictmod) {
  SWModule * dmod;
  dmod = MyManager->getModule(lexdictmod);
  if (!dmod) {
    xsThrow("GetAllDictionaryKeys: module not found.");
    return NULL;
  }

  SWKey *tkey = dmod->CreateKey();
  if (!SWDYNAMIC_CAST(StrKey, tkey)) {
    delete(tkey);
    xsThrow("GetAllDictionaryKeys: module is not a Dictionary.");
    return NULL;
  }
  delete(tkey);

  dmod->setPosition(TOP);

  long count=0;
  SWBuf keytext;
  while (!dmod->Error() && count++<MAXDICTSIZE) {
    keytext.append(dmod->getKeyText());
    keytext.append("<nx>");
   //printf("%s\n", dmod->getKeyText());
   //printf("%i\n", count);
   dmod->increment(1);
  }

  char *retval;
  retval = (char *)emalloc(keytext.length() + 1);
  if (retval) {strcpy(retval, keytext.c_str());}
	return retval;
}


/********************************************************************
GetGenBookChapterText
*********************************************************************/
char *xulsword::getGenBookChapterText(const char *gbmod, const char *treekey) {
  SWModule * module = MyManager->getModule(gbmod);
  if (!module) {
    xsThrow("GetGenBookChapterText: module not found.");
    return NULL;
  }

  updateGlobalOptions(false);

  SWKey *testkey = module->CreateKey();
  TreeKey *key = SWDYNAMIC_CAST(TreeKey, testkey);
  if (!key) {
    delete(testkey);
    xsThrow("GetGenBookChapterText: module is not a General-Book.");
    return NULL;
  }

  if (!strcmp(treekey, "/")) {
    key->root();
    key->firstChild();
  }
  else {key->setText(treekey);}

  key->Persist(1);
  module->setKey(key);
  if (module->Error()) key->root();

  SWBuf chapterText;
  chapterText.set(module->RenderText());
  module->SetKey(EmptyKey);
  
  delete(testkey);

  char *retval;
  retval = (char *)emalloc(chapterText.length() + 1);
  if (retval) {strcpy(retval, chapterText.c_str());}
	return retval;
}


/********************************************************************
GetGenBookTableOfContents
*********************************************************************/
char *xulsword::getGenBookTableOfContents(const char *gbmod) {
  SWModule * module = MyManager->getModule(gbmod);
  if (!module) {
    xsThrow("GetGenBookTableOfContents: module not found.");
    return NULL;
  }

  SWKey *testkey = module->CreateKey();
  TreeKey *key = SWDYNAMIC_CAST(TreeKey, testkey);
  if (!key) {
    delete(testkey);
    xsThrow("GetGenBookTableOfContents: module is not a General-Book.");
    return NULL;
  }

  SWBuf toc;
  // xulSword requires the following header for the RDF file
  toc.set("<?xml version=\"1.0\"?>\n\n<RDF:RDF xmlns:TABLEOFCONTENTS=\"http://www.xulsword.com/tableofcontents/rdf#\" \n\t\txmlns:NC=\"http://home.netscape.com/NC-rdf#\" \n\t\txmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n\n");

  // xulSword requires a table of contents having a single folder with name of the module
  toc.appendFormatted("\t<RDF:Bag RDF:about=\"rdf:#%s\">\n\t\t<RDF:li RDF:resource=\"rdf:#/%s\" />\n\t</RDF:Bag>\n\n",
        ROOTRDF,
        gbmod);

  // describe and create the root itself...
  key->root();
  toc.appendFormatted("\t<RDF:Description RDF:about=\"rdf:#/%s\" \n\t\t\tTABLEOFCONTENTS:Chapter=\"rdf:#/%s\" \n\t\t\tTABLEOFCONTENTS:Type=\"folder\" \n\t\t\tTABLEOFCONTENTS:Name=\"%s\" />\n",
        gbmod,
        key->getText(),
        gbmod);

  // fill the root folder with everything else...
  SWBuf body;
  getFolderContents(key, gbmod, &body);
  toc.append(body);

  toc.append("</RDF:RDF>");

  delete(testkey);

  char *retval;
  retval = (char *)emalloc(toc.length() + 1);
  if (retval) {strcpy(retval, toc.c_str());}
	return retval;
}


/********************************************************************
LuceneEnabled
*********************************************************************/
bool xulsword::luceneEnabled(const char *mod) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {return false;}

  bool supported = true;
  ListKey tmp = module->search(NULL,-4,NULL,NULL,&supported,NULL,NULL);

  return supported;
}


/********************************************************************
Search
*********************************************************************/
int xulsword::search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {
    xsThrow("Search: module not found.");
    return NULL;
  }

  ListKey listkeyInt;
  ListKey scopeK;
  VerseKey parser;
  SWKey key;

  SWBuf searchString;

  int type1;
  char noneed = 0;

  searchString.set(module->StripText(srchstr));

  SWKey *nvk;
  SWKey *testkey = module->CreateKey();
  VerseKey *modvkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (modvkey) {
    parser.setVersificationSystem(modvkey->getVersificationSystem());
    scopeK = parser.ParseVerseList(scope, parser, true);
    nvk = scopeK.getElement();
    nvk->Persist(1);
    module->setKey(nvk);
  }
  delete(testkey);

  Searchedvers = getVerseSystemOfModule(mod);

  /*
   *                 >=0  - regex
   *                      -1  - phrase
   *                      -2  - multiword
   *                      -3  - entryAttrib (eg. Word//Strongs/G1234/)
   *                      -4  - Lucene
   */

  if (type == -5) {type1 = -2;}
  else {type1 = type;}

  ListKey tmpkeys;
  ListKey *workKeys;
  if (!newsearch) {workKeys = &tmpkeys;}
  else {
    SearchList.clear();
    workKeys = &SearchList;
  }
  
  // COMPOUND SEARCH- currently a phrase search with nearly the speed of a multiword search
  if (type == -5) {
    listkeyInt = module->search(searchString.c_str(), type1, flags, 0, 0, &savePercentComplete, NULL);
    if (listkeyInt.Count() > 0) {
      //searchString.Insert("[^[:alpha:]]",0);
      //searchString.Append("[^[:alpha:]]");
      listkeyInt.Persist(1);
      module->setKey(listkeyInt);
      //*workKeys = module->search(searchString.get(), 0, flags, 0, 0, &savePercentComplete, NULL);
      *workKeys = module->search(searchString.c_str(), -1, flags, 0, 0, &savePercentComplete, NULL);
    }
  }
  // SIMPLE SEARCH
  else {*workKeys = module->search(searchString.c_str(), type1, flags, 0, 0, &savePercentComplete, NULL);}

  // If not a new search append new results to existing key
  if (!newsearch) {
    workKeys->setPosition(TOP);
    while (!workKeys->Error()) {
      SWKey *akey;
      akey = module->CreateKey(); // get correctly versified key
      akey->setText(workKeys->getText());
      SearchList.add(*akey);
      delete(akey);
      workKeys->increment(1);
    }
  }
  module->setKey(EmptyKey);

  MySearchVerses.set("");

  return SearchList.Count();
}


/********************************************************************
GetSearchResults
*********************************************************************/
char *xulsword::getSearchResults(const char *mod, int first, int num, bool keepStrongs) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {
    xsThrow("GetSearchResults: module not found.");
    return NULL;
  }

  if (num==0) {num=SearchList.Count();}

  if (keepStrongs) {updateGlobalOptions(true);}
  else {
    MyManager->setGlobalOption("Headings","Off");
    MyManager->setGlobalOption("Footnotes","Off");
    MyManager->setGlobalOption("Cross-references","Off");
    MyManager->setGlobalOption("Dictionary","Off");
    MyManager->setGlobalOption("Words of Christ in Red","Off");
    MyManager->setGlobalOption("Strong's Numbers","Off");
    MyManager->setGlobalOption("Morphological Tags","Off");
    MyManager->setGlobalOption("Morpheme Segmentation","Off");
  }

  MySearchTexts.set("");
  SearchList.SetToElement(first,TOP);
  int written=0;
  int savePersist = SearchList.Persist();

  SWKey * testkey = module->CreateKey();
  VerseKey * modvkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (modvkey) {
    const char *toVS = modvkey->getVersificationSystem();
    delete(testkey);
    VerseKey fromkey;
    VerseKey tokey;
    fromkey.setVersificationSystem(Searchedvers);
    tokey.setVersificationSystem(toVS);

    tokey.Persist(1);
    module->setKey(tokey);
    tokey.setAutoNormalize(0); // Non-existant calls should return empty string!

    while (!SearchList.Error()&&(written<num)) {
      fromkey=SearchList;
      if ((!strcmp(Searchedvers,WESTERN) && (!strcmp(toVS,EASTERN) || strstr(toVS,SYNODAL))) ||
      (!strcmp(toVS,WESTERN) && (!strcmp(Searchedvers,EASTERN) || strstr(Searchedvers,SYNODAL)))) {
        tokey.setVersificationSystem(toVS);
        mapVersifications(&fromkey, &tokey);
      }
      else {tokey.copyFrom(fromkey);}

      MySearchTexts.append(tokey.getOSISRef());
      MySearchTexts.append("<bg>");
      keepStrongs ? MySearchTexts.append(module->RenderText()):MySearchTexts.append(module->StripText());
      MySearchTexts.append("<nx>");

      MySearchVerses.append(tokey.getOSISRef());
      MySearchVerses.append("<nx>");
      
      SearchList++;
      written++;
    }
  }
  else {
    delete(testkey);
    SearchList.Persist(1);
    module->setKey(SearchList);
    while (!SearchList.Error()&&(written<num)) {
      MySearchTexts.append(module->getKeyText());
      MySearchTexts.append("<bg>");
      keepStrongs ? MySearchTexts.append(module->RenderText()):MySearchTexts.append(module->StripText());
      MySearchTexts.append("<nx>");

      MySearchVerses.append(module->getKeyText());
      MySearchVerses.append("<nx>");

      SearchList++;
      written++;
    }
  }

  module->setKey(EmptyKey); // Overcomes the crash on Persist problem
  SearchList.Persist(savePersist);

  char *retval;
  retval = (char *)emalloc(MySearchTexts.length() + 1);
  if (retval) {strcpy(retval, MySearchTexts.c_str());}
	return retval;
}


/********************************************************************
SearchIndexDelete
*********************************************************************/
void xulsword::searchIndexDelete(const char *mod) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {return;}

  if (!module->hasSearchFramework()) {return;}

  module->deleteSearchFramework();
}


/********************************************************************
SearchIndexBuild
*********************************************************************/
void xulsword::searchIndexBuild(const char *mod) {
  SWModule * module = MyManager->getModule(mod);
  if (module && ReportProgress) {
    if (module->hasSearchFramework()) {
      module->createSearchFramework(&savePercentComplete, (void *)ReportProgress);
    }
  }
}


/********************************************************************
SetGlobalOption
*********************************************************************/
void xulsword::setGlobalOption(const char *option, const char *setting) {
  bool * thisOption;

  // Find which global option we are updating
  if      (!strcmp(option,"Headings"))               {thisOption = &Headings;}
  else if (!strcmp(option,"Footnotes"))              {thisOption = &Footnotes;}
  else if (!strcmp(option,"Cross-references"))       {thisOption = &Crossrefs;}
  else if (!strcmp(option,"Dictionary"))             {thisOption = &Dictionary;}
  else if (!strcmp(option,"Words of Christ in Red")) {thisOption = &Redwords;}
  else if (!strcmp(option,"Verse Numbers"))          {thisOption = &Versenumbers;}
  else if (!strcmp(option,"Hebrew Vowel Points"))    {thisOption = &HebrewPoints;}
  else if (!strcmp(option,"Hebrew Cantillation"))    {thisOption = &Cantillation;}
  else if (!strcmp(option,"Strong's Numbers"))       {thisOption = &Strongs;}
  else if (!strcmp(option,"Morphological Tags"))     {thisOption = &Morph;}
  else if (!strcmp(option,"Morpheme Segmentation"))  {thisOption = &MorphSeg;}
  else {xsThrow("SetGlobalOption: unknown option."); return;}

  // Now update the global option
  if (!strcmp(setting,"On"))  {*thisOption = 1;}
  else if (!strcmp(setting,"Off")) {*thisOption = 0;}
  else {xsThrow("SetGlobalOption: setting was not 'On' or 'Off'."); return;}
}


/********************************************************************
GetGlobalOption
*********************************************************************/
char *xulsword::getGlobalOption(const char *option) {
  bool *thisOption;
  SWBuf rCText;

  //Find which global option is being asked for
  if      (!strcmp(option,"Headings"))               {thisOption = &Headings;}
  else if (!strcmp(option,"Footnotes"))              {thisOption = &Footnotes;}
  else if (!strcmp(option,"Cross-references"))       {thisOption = &Crossrefs;}
  else if (!strcmp(option,"Dictionary"))             {thisOption = &Dictionary;}
  else if (!strcmp(option,"Words of Christ in Red")) {thisOption = &Redwords;}
  else if (!strcmp(option,"Verse Numbers"))          {thisOption = &Versenumbers;}
  else if (!strcmp(option,"Hebrew Vowel Points"))    {thisOption = &HebrewPoints;}
  else if (!strcmp(option,"Hebrew Cantillation"))    {thisOption = &Cantillation;}
  else if (!strcmp(option,"Strong's Numbers"))       {thisOption = &Strongs;}
  else if (!strcmp(option,"Morphological Tags"))     {thisOption = &Morph;}
  else if (!strcmp(option,"Morpheme Segmentation"))  {thisOption = &MorphSeg;}
  else {xsThrow("GetGlobalOption: unknown option."); return NULL;}

  // Now return the proper value
  *thisOption ? rCText.set("On") : rCText.set("Off");

  char *retval;
  retval = (char *)emalloc(rCText.length() + 1);
  if (retval) {strcpy(retval, rCText.c_str());}
	return retval;
}


/********************************************************************
SetCipherKey
*********************************************************************/
void xulsword::setCipherKey(const char *mod, const char *cipherkey, bool useSecModule) {
  SWModule *module;
  module = MyManager->getModule(mod);
  if (!module) {
    delete(module);
    xsThrow("SetCipherKey: module not found.");
    return;
  }
      
  #ifndef NOSECURITY
    if (useSecModule) {
      SWBuf paramstring;
      paramstring.set(NOTFOUND);
      ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&module->getConfig());
      ConfigEntMap::iterator it = infoConfig->find(MODVERSION);
      if (it != infoConfig->end()) {paramstring.set(it->second.c_str());}

      //printf("mod:%s, ver:%s\n", mod, paramstring.get());
      InstSecurity.ModCipherKey(Outtext, cipherkey, paramstring.c_str(), mod);
    }
    else {sprintf(Outtext,"%s", cipherkey);}
    
  #else
    sprintf(Outtext,"%s", cipherkey);
    
  #endif

  // Set the new Cipher Key. IF WRONG CIPHER KEY IS GIVEN, IT CANNOT BE CHANGED WITHOUT RELOAD (SWORD BUG)
  MyManager->setCipherKey(mod, Outtext);
}


/********************************************************************
GetModuleList()
*********************************************************************/
char* xulsword::getModuleList() {
	std::string tr;
	SWModule * module;

  bool first = true;
	for (modIterator = MyManager->Modules.begin(); modIterator != MyManager->Modules.end(); modIterator++) {
		module = (*modIterator).second;
		if (!first) {tr.append("<nx>");}
		tr.append(module->Name());
		tr.append(";");
		tr.append(module->Type());
		first = false;
	}

	if (!strcmp(tr.c_str(), "")) {tr.assign("No Modules");}

  char *retval;
  retval = (char *)emalloc(tr.length() + 1);
  if (retval) {strcpy(retval, tr.c_str());}
	return retval;
}


/********************************************************************
GetModuleInformation
*********************************************************************/
char *xulsword::getModuleInformation(const char *mod, const char *paramname) {
  SWModule * infoModule;
  infoModule = MyManager->getModule(mod);
  SWBuf paramstring;

  if (infoModule) {
    ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&infoModule->getConfig());
    ConfigEntMap::iterator it = infoConfig->find(paramname);

    if (it == infoConfig->end()) {paramstring.set(NOTFOUND);}
    else {
      paramstring.set(it->second.c_str());
      it++;
      while (it != infoConfig->end() && !strcmp(it->first.c_str(), paramname)) {
        paramstring.append("<nx>");
        paramstring.append(it->second.c_str());
        it++;
      }
    }
  }

  char *retval;
  retval = (char *)emalloc(paramstring.length() + 1);
  if (retval) {strcpy(retval, paramstring.c_str());}
	return retval;
}
// END class xulsword

/********************************************************************
CUSTOM DERIVATIVE CLASSES
*********************************************************************/


/********************************************************************
SWMgrXS - to over-ride modules and how they are loaded
*********************************************************************/
SWMgrXS::SWMgrXS(const char *iConfigPath, bool autoload, SWFilterMgr *filterMgr, bool multiMod, bool xaugmentHome)
    : SWMgr(iConfigPath, autoload, filterMgr, multiMod, xaugmentHome) {

  mgrModeMultiMod = multiMod;
  augmentHome = xaugmentHome;
}

signed char SWMgrXS::Load() {
SWLog::getSystemLog()->logDebug("SWMgrXS Load");
//COPIED from SWMgr::Load 3/6/2012
	signed char ret = 0;

//EDIT: adding OSISDictionary filter
  SWOptionFilter *tmpFilter = 0;
  tmpFilter = new OSISDictionary();
  optionFilters.insert(OptionFilterMap::value_type("OSISDictionary", tmpFilter));
  cleanupFilters.push_back(tmpFilter);
//EDIT_END

	if (!config) {	// If we weren't passed a config object at construction, find a config file
		if (!configPath) {	// If we weren't passed a config path at construction...
			SWLog::getSystemLog()->logDebug("LOOKING UP MODULE CONFIGURATION...");
			SWConfig *externalSysConf = sysConfig;	// if we have a sysConf before findConfig, then we were provided one from an external source.
			findConfig(&configType, &prefixPath, &configPath, &augPaths, &sysConfig);
			if (!externalSysConf) mysysconfig = sysConfig;	// remind us to delete our own sysConfig in d-tor
			SWLog::getSystemLog()->logDebug("LOOKING UP MODULE CONFIGURATION COMPLETE.");
		}
		if (configPath) {
			if (configType)
				loadConfigDir(configPath);
			else	config = myconfig = new SWConfig(configPath);
		}
	}

	if (config) {
		SectionMap::iterator Sectloop, Sectend;
		ConfigEntMap::iterator Entryloop, Entryend;

		DeleteMods();

		for (Sectloop = config->Sections.lower_bound("Globals"), Sectend = config->Sections.upper_bound("Globals"); Sectloop != Sectend; Sectloop++) {		// scan thru all 'Globals' sections
			for (Entryloop = (*Sectloop).second.lower_bound("AutoInstall"), Entryend = (*Sectloop).second.upper_bound("AutoInstall"); Entryloop != Entryend; Entryloop++)	// scan thru all AutoInstall entries
				InstallScan((*Entryloop).second.c_str());		// Scan AutoInstall entry directory for new modules and install
		}
		if (configType) {	// force reload on config object because we may have installed new modules
			delete myconfig;
			config = myconfig = 0;
			loadConfigDir(configPath);
		}
		else	config->Load();

//EDIT:
// sword-1.6.1 Synodal canon was missing Psalms 114:9, but we need to detect it and continue its support
    ConfigEntMap::iterator versif, mv;
    SectionMap::iterator it;
    for (it = config->Sections.begin(); it != config->Sections.end(); it++) {
		  ConfigEntMap &section = (*it).second;
		  SWBuf versification = ((versif = section.find("Versification")) != section.end()) ? (*versif).second : (SWBuf)"KJV";
    	if (versification == "Synodal") {
    		SWBuf minvers = ((mv = section.find("MinimumVersion"))  != section.end()) ? (*mv).second : (SWBuf)"1.6.1";
    		if (minvers == "1.6.1") {versification = "Synodal0";}
    		(*versif).second = versification.c_str();
    	}
		}
//EDIT_END

		CreateMods(mgrModeMultiMod);

		for (std::list<SWBuf>::iterator pathIt = augPaths.begin(); pathIt != augPaths.end(); pathIt++) {
			augmentModules(pathIt->c_str(), mgrModeMultiMod);
		}
		if (augmentHome) {
			// augment config with ~/.sword/mods.d if it exists ---------------------
			SWBuf homeDir = getHomeDir();
			if (homeDir.length() && configType != 2) { // 2 = user only
				SWBuf path = homeDir;
				path += ".sword/";
				augmentModules(path.c_str(), mgrModeMultiMod);
				path = homeDir;
				path += "sword/";
				augmentModules(path.c_str(), mgrModeMultiMod);
			}
		}
// -------------------------------------------------------------------------
		if (!Modules.size()) // config exists, but no modules
			ret = 1;

	}
	else {
		SWLog::getSystemLog()->logError("SWMgr: Can't find 'mods.conf' or 'mods.d'.  Try setting:\n\tSWORD_PATH=<directory containing mods.conf>\n\tOr see the README file for a full description of setup options (%s)", (configPath) ? configPath : "<configPath is null>");
		ret = -1;
	}

	return ret;
}


/********************************************************************
StringMgrXS - to over-ride broken toUpperCase
*********************************************************************/
StringMgrXS::StringMgrXS(char *(*toUpperCase)(char *)) {ToUpperCase = toUpperCase;}

char *StringMgrXS::upperUTF8(char *text, unsigned int max) const {
  text = ToUpperCase(text);
  return text;
}


/********************************************************************
MarkupFilterMgrXS - to implement xulsword's own OSIS markup filters
*********************************************************************/
MarkupFilterMgrXS::MarkupFilterMgrXS() {
  markup = -1;
  fromplain = NULL;
  fromthml = new ThMLXHTMLXS();
  fromgbf = new GBFXHTMLXS();
  fromosis = new OSISXHTMLXS();
  fromtei = NULL;
}

MarkupFilterMgrXS::~MarkupFilterMgrXS() {
  // parent destructor takes case of everything
}


/********************************************************************
SWLogXS - to implement xulsword's own OSIS markup filters
*********************************************************************/
SWLogXS::SWLogXS() {}
SWLogXS::~SWLogXS() {}
void SWLogXS::logMessage(const char *message, int level) const {
#ifndef PHPSWORD
	std::cerr << message;
	std::cerr << std::endl;
#else
  printf("%s\n", message);
#endif
}
