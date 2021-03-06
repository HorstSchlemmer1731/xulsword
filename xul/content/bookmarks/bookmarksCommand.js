/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// BookmarksCommand and BookmarksUtils objects are used to perform bookmark
// commands relating to DOM elements in this context.
var BookmarksCommand = {

  /////////////////////////////////////////////////////////////////////////////
  // This method constructs a menuitem for a context menu for the given command.
  // This is implemented by the client so that it can intercept menuitem naming
  // as appropriate.
  createMenuItem: function (aDisplayName, aAccessKey, aCommandName, aSelection)
  {
    var xulElement = document.createElementNS(BM.gXUL_NS, "menuitem");
    xulElement.setAttribute("cmd", aCommandName);
    var cmd = "cmd_" + aCommandName.substring(BM.gNC_NS_CMD.length);
    xulElement.setAttribute("command", cmd);
    xulElement.setAttribute("label", aDisplayName);
    if (aAccessKey) xulElement.setAttribute("accesskey", aAccessKey);
    return xulElement;
  },

  /////////////////////////////////////////////////////////////////////////////
  // Fill a context menu popup with menuitems that are appropriate for the current
  // selection.
  createContextMenu: function (aEvent, aSelection, aDS)
  {
    if (aSelection == undefined) {
      aEvent.preventDefault();
      return;
    }

    var popup = aEvent.target;
    // clear out the old context menu contents (if any)
    while (popup.hasChildNodes()) 
      popup.removeChild(popup.firstChild);
        
    var commonCommands = [];
    for (var i = 0; i < aSelection.length; ++i) {
      var commands = this.getCommands(aSelection.item[i], aSelection.parent[i], aDS);
      if (!commands) {
        aEvent.preventDefault();
        return;
      }
      commands = this.flattenEnumerator(commands);
      if (!commonCommands.length) commonCommands = commands;
      commonCommands = this.findCommonNodes(commands, commonCommands);
    }

    if (!commonCommands.length) {
      aEvent.preventDefault();
      return;
    }
    
    // Now that we should have generated a list of commands that is valid
    // for the entire selection, build a context menu.
    for (i = 0; i < commonCommands.length; ++i) {
      var currCommand = commonCommands[i].QueryInterface(Components.interfaces.nsIRDFResource).ValueUTF8;
      var element = null;
      if (currCommand != BM.gNC_NS_CMD + "bm_separator") {
        var commandName = this.getCommandName(currCommand);
        var accessKey = this.getAccessKey(currCommand);
        element = this.createMenuItem(commandName, null, currCommand, aSelection);
      }
      else if (i != 0 && i < commonCommands.length-1) {
        // Never append a separator as the first or last element in a context
        // menu.
        element = document.createElementNS(BM.gXUL_NS, "menuseparator");
      }
      if (element) 
        popup.appendChild(element);
    }

    if (popup.firstChild.getAttribute("command") == "cmd_bm_open")
      popup.firstChild.setAttribute("default", "true");
  },
  
  /////////////////////////////////////////////////////////////////////////////
  // Given two unique arrays, return an array that contains only the elements
  // common to both. 
  findCommonNodes: function (aNewArray, aOldArray)
  {
    var common = [];
    for (var i = 0; i < aNewArray.length; ++i) {
      for (var j = 0; j < aOldArray.length; ++j) {
        if (common.length > 0 && common[common.length-1] == aNewArray[i])
          continue;
        if (aNewArray[i] == aOldArray[j])
          common.push(aNewArray[i]);
      }
    }
    return common;
  },

  flattenEnumerator: function (aEnumerator)
  {
    if ("_index" in aEnumerator)
      return aEnumerator._inner;
    
    var temp = [];
    while (aEnumerator.hasMoreElements()) 
      temp.push(aEnumerator.getNext());
    return temp;
  },
  
  /////////////////////////////////////////////////////////////////////////////
  // For a given URI (a unique identifier of a resource in the graph) return 
  // an enumeration of applicable commands for that URI. 
  getCommands: function (aNodeID, aParent, aDS)
  {
    var type = BookmarksUtils.resolveType(aNodeID, aDS);
    if (!type)
      return null;

    var ptype = null;
    aParent =  (aParent != null) ? aParent : BookmarksUtils.getParent(aNodeID,BMDS);
    if (aParent) {
      ptype = BookmarksUtils.resolveType(aParent, aDS);
    }

    var commands = [];
    // menu order:
    // 
    // bm_open, bm_openfolder
    // bm_openinnewwindow
    // bm_openinnewtab
    // ---------------------
    // bm_newfolder
    // ---------------------
    // cut
    // copy
    // paste
    // ---------------------
    // delete
    // ---------------------
    // bm_refreshlivemark
    // bm_refreshmicrosummary
    // bm_sortbyname
    // ---------------------
    // bm_properties
    switch (type) {
    case "BookmarkSeparator":
      commands = ["bm_newbookmark", "bm_newfolder", "bm_newseparator", "bm_separator",
                  "bm_cut", "bm_copy", "bm_paste", "bm_separator",
                  "bm_delete", "bm_separator",
                  "bm_sortbyname", "bm_separator",
                  "bm_properties"];
      break;
    case "Bookmark":
      commands = ["bm_open", "bm_separator",
                  "bm_newbookmark", "bm_newfolder", "bm_newseparator", "bm_separator",
                  "bm_cut", "bm_copy", "bm_paste", "bm_separator",
                  "bm_delete", "bm_separator",
                  "bm_sortbyname", "bm_separator",
                  "bm_properties"];
      break;
    case "Folder":
      commands = ["bm_separator", "bm_newbookmark", 
                  "bm_newfolder", "bm_newseparator", "bm_separator",
                  "bm_cut", "bm_copy", "bm_paste", "bm_separator",
                  "bm_delete", "bm_separator",
                  "bm_sortbyname", "bm_separator",
                  "bm_properties"];
      break;
    case "ImmutableBookmark":
      if (aNodeID==BM.BmEmptyRes) commands = ["bm_newbookmark", "bm_newfolder"];
      else commands = [];
      break;
    default: 
      commands = ["delete"];
    }

    return new CommandArrayEnumerator(commands);
  },
  
  /////////////////////////////////////////////////////////////////////////////
  // Retrieve the human-readable name for a particular command. Used when 
  // manufacturing a UI to invoke commands.
  getCommandName: function (aCommand) 
  {
    var cmdName = aCommand.substring(BM.gNC_NS_CMD.length);
    var useCommonNameFor = ["bm_cut", "bm_copy", "bm_paste", "bm_delete"];
    var commonName = ["cut", "copy", "paste", "delete"];
    for (var i=0; i<useCommonNameFor.length; i++) {
      if (cmdName == useCommonNameFor[i]) {
        cmdName = commonName[i];
        break;
      }
    }
    
    return BookmarksUtils.getLocaleString ("cmd_" + cmdName);
  },

  /////////////////////////////////////////////////////////////////////////////
  // Retrieve the access key for a particular command. Used when 
  // manufacturing a UI to invoke commands.
  getAccessKey: function (aCommand) 
  {
    var cmdName = aCommand.substring(BM.gNC_NS_CMD.length);
    var useCommonNameFor = ["bm_cut", "bm_copy", "bm_paste", "bm_delete"];
    var commonName = ["cut", "copy", "paste", "delete"];
    for (var i=0; i<useCommonNameFor.length; i++) {
      if (cmdName == useCommonNameFor[i]) {
        cmdName = commonName[i];
        break;
      }
    }
    return BookmarksUtils.getLocaleString ("cmd_" + cmdName + "_accesskey");
  },
  
  ///////////////////////////////////////////////////////////////////////////
  // Execute a command with the given source and arguments
  doBookmarksCommand: function (aSource, aCommand, aArgumentsArray)
  {
    var rCommand = BM.RDF.GetResource(aCommand);
  
    var kSuppArrayContractID = "@mozilla.org/supports-array;1";
    var kSuppArrayIID = Components.interfaces.nsISupportsArray;
    var sourcesArray = Components.classes[kSuppArrayContractID].createInstance(kSuppArrayIID);
    if (aSource) {
      sourcesArray.AppendElement(aSource);
    }
  
    var argsArray = Components.classes[kSuppArrayContractID].createInstance(kSuppArrayIID);
    var length = aArgumentsArray?aArgumentsArray.length:0;
    for (var i = 0; i < length; ++i) {
      var rArc = BM.RDF.GetResource(aArgumentsArray[i].property);
      argsArray.AppendElement(rArc);
      var rValue = null;
      if ("resource" in aArgumentsArray[i]) { 
        rValue = BM.RDF.GetResource(aArgumentsArray[i].resource);
      }
      else
        rValue = BM.RDF.GetLiteral(aArgumentsArray[i].literal);
      argsArray.AppendElement(rValue);
    }

    // Exec the command in the Bookmarks datasource. 
    BMDS.DoCommand(sourcesArray, rCommand, argsArray);
  },

  undoBookmarkTransaction: function ()
  {
    BM.gTxnSvc.undoTransaction();
    BookmarksUtils.refreshSearch();
    BookmarksUtils.flushDataSource();
  },

  redoBookmarkTransaction: function ()
  {
    BM.gTxnSvc.redoTransaction();
    BookmarksUtils.refreshSearch();
    BookmarksUtils.flushDataSource();
  },

  manageFolder: function (aSelection)
  {
    //openDialog("chrome://browser/content/bookmarks/bookmarksManager/bookmarksManager.xul","", "chrome,all,dialog=no", aSelection.item[0].ValueUTF8);
  },
  
  cutBookmark: function (aSelection)
  {
    this.copyBookmark(aSelection);
    BookmarksUtils.removeAndCheckSelection("cut", aSelection);
  },

  copyBookmark: function (aSelection)
  {
    const kSuppArrayContractID = "@mozilla.org/supports-array;1";
    const kSuppArrayIID = Components.interfaces.nsISupportsArray;
    var itemArray = Components.classes[kSuppArrayContractID].createInstance(kSuppArrayIID);

    const kSuppWStringContractID = "@mozilla.org/supports-string;1";
    const kSuppWStringIID = Components.interfaces.nsISupportsString;
    var bmstring = Components.classes[kSuppWStringContractID].createInstance(kSuppWStringIID);
    var unicodestring = Components.classes[kSuppWStringContractID].createInstance(kSuppWStringIID);
    var htmlstring = Components.classes[kSuppWStringContractID].createInstance(kSuppWStringIID);
  
    var sBookmarkItem = ""; var sTextUnicode = ""; var sTextHTML = ""; var tmpBmItem = [];
    for (var i = 0; i < aSelection.length; ++i) {
      sBookmarkItem += aSelection.item[i].ValueUTF8 + "\n";

      // save the selection property into text string that we will use later in paste function
      // and in INSERT tranasactions
      // (if the selection is folder or livemark save all childs property)
      var aType = BookmarksUtils.resolveType(aSelection.item[i]);
         for (var j = 0; j < BM.gBmProperties.length; ++j) {
            var itemValue = BMDS.GetTarget(aSelection.item[i], BM.gBmProperties[j], true);
            if (itemValue)
                sBookmarkItem += itemValue.QueryInterface(Components.interfaces.nsIRDFLiteral).Value + "\n";
            else
                sBookmarkItem += "\n";
         }
      var childCount = 1;
      if (aType == "Folder" || aType == "Livemark") {
         var propArray = [];
         BookmarksUtils.getAllChildren(aSelection.item[i], propArray);
         for (var k = 0; k < propArray.length; ++k) {
            for (var j = 0; j < BM.gBmProperties.length + 1; ++j) {
               if (propArray[k][j])
                   sBookmarkItem += propArray[k][j].QueryInterface(Components.interfaces.nsIRDFLiteral).Value + "\n";
               else
                   sBookmarkItem += "\n";
            }
         }
         childCount += propArray.length;
      }
      tmpBmItem.push(childCount +  "\n" + sBookmarkItem);
      sBookmarkItem = "";
    }
    
    // generate unique separator and combine the array to one string 
    var bmSeparator = "]-[", extrarSeparator = "@";
    for (var i = 0; i < tmpBmItem.length; ++i) {
        while (tmpBmItem[i].indexOf(bmSeparator)>-1)
           bmSeparator += extrarSeparator;
    }
    for (var i = 0; i < tmpBmItem.length; ++i) {
      sBookmarkItem += tmpBmItem[i] + bmSeparator;
    }
    // insert the separator to sBookmarkItem so we can extract it in pasteBookmark
    sBookmarkItem = bmSeparator + "\n" + sBookmarkItem;
    
    const kXferableContractID = "@mozilla.org/widget/transferable;1";
    const kXferableIID = Components.interfaces.nsITransferable;
    var xferable = Components.classes[kXferableContractID].createInstance(kXferableIID);

    xferable.addDataFlavor("moz/bookmarkclipboarditem");
    bmstring.data = sBookmarkItem;
    xferable.setTransferData("moz/bookmarkclipboarditem", bmstring, sBookmarkItem.length*2);
    
    xferable.addDataFlavor("text/html");
    htmlstring.data = sBookmarkItem;
    xferable.setTransferData("text/html", htmlstring, sBookmarkItem.length*2);
    
    xferable.addDataFlavor("text/unicode");
    unicodestring.data = sBookmarkItem;
    xferable.setTransferData("text/unicode", unicodestring, sBookmarkItem.length*2);
    
    const kClipboardContractID = "@mozilla.org/widget/clipboard;1";
    const kClipboardIID = Components.interfaces.nsIClipboard;
    var clipboard = Components.classes[kClipboardContractID].getService(kClipboardIID);
    clipboard.setData(xferable, null, kClipboardIID.kGlobalClipboard);
  },

  pasteBookmark: function (aTarget)
  {
    const kXferableContractID = "@mozilla.org/widget/transferable;1";
    const kXferableIID = Components.interfaces.nsITransferable;
    var xferable = Components.classes[kXferableContractID].createInstance(kXferableIID);
    xferable.addDataFlavor("moz/bookmarkclipboarditem");
    xferable.addDataFlavor("text/x-moz-url");
    xferable.addDataFlavor("text/unicode");

    const kClipboardContractID = "@mozilla.org/widget/clipboard;1";
    const kClipboardIID = Components.interfaces.nsIClipboard;
    var clipboard = Components.classes[kClipboardContractID].getService(kClipboardIID);
    clipboard.getData(xferable, kClipboardIID.kGlobalClipboard);
    
    var flavour = { };
    var data    = { };
    var length  = { };
    xferable.getAnyTransferData(flavour, data, length);
    var items, name, url, childs, removedProps = [];
    data = data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    switch (flavour.value) {
    case "moz/bookmarkclipboarditem":
      var tmpItem = data.split("\n");
      var sep = tmpItem.shift();
      data = tmpItem.join("\n");
      items = data.split(sep);
      // since data are ended by separator, remove the last empty node
      items.pop(); 
      // convert propery from text string to array
      var p = BM.gBmProperties.length+1;
      for (var i = 0; i < items.length; ++i) {
        childs = items[i].split("\n");
        childs.pop();
        var childCount = childs.shift();
        items[i] = BM.RDF.GetResource(childs[0]);
        var propArray = [];
        for (var k = 0; k < childCount; ++k) {
          for (var j = 1; j < p; ++j) {
             var prop = childs[p*k+j];
             if (prop)
                 propArray.push(BM.RDF.GetLiteral(prop));
             else
                 propArray.push(null);
          }
        }
        removedProps.push(propArray);
      }
      break;

    default: 
      return;
    }
   
    var selection = {item: items, parent:Array(items.length), length: items.length, prop: removedProps};
    BookmarksUtils.checkSelection(selection);
    BookmarksUtils.insertAndCheckSelection("paste", selection, aTarget, -1);
  },
  
  deleteBookmark: function (aSelection)
  {
    // call checkSelection here to update the immutable and other
    // flags on the selection; when new resources get created,
    // they're temporarily not valid because they're not in a
    // bookmark container.  So, they can't be removed until that's
    // fixed.

    BookmarksUtils.checkSelection(aSelection);
    BookmarksUtils.removeAndCheckSelection("delete", aSelection);
  },

  moveBookmark: function (aSelection)
  {
    var rv = { selectedFolder: null };      
    openDialog("chrome://xulsword/content/bookmarks/moveBookmark/moveBookmark.xul", "", 
               "centerscreen,chrome,modal=yes,dialog=yes,resizable=yes", null, 
               null, null, null, "selectFolder", rv);
    if (!rv.target)
      return;
    BookmarksUtils.moveAndCheckSelection("move", aSelection, rv.target);
  },

  openBookmark: function (aSelection, aTargetBrowser, aDS) 
  {
    if (BookmarksUtils.resolveType(aSelection.item[0], BMDS) != "Bookmark") return;
    // Update Last Visited...
    var currentDate = new Date().toLocaleDateString();
    var parent = ResourceFuns.getParentOfResource(aSelection.item[0], BMDS);
    var visited = [aSelection.item[0]];
    if (parent && parent.ValueUTF8!=BM.AllBookmarksID) visited.push(parent);
    for (var i=0; i<visited.length; i++) {
      ResourceFuns.updateAttribute(visited[i], BM.gBmProperties[VISITEDDATE], BMDS.GetTarget(visited[i], BM.gBmProperties[VISITEDDATE], true), BM.RDF.GetLiteral(currentDate));
    }
    BookmarkFuns.gotoBookMark(aSelection.item[0].ValueUTF8);
  },
  
  openBookmarkProperties: function (aSelection) 
  {
    var bookmark = aSelection.item[0].ValueUTF8;
    return BookmarkFuns.showPropertiesWindow(window, bookmark, false);
  },

  createNewBookmark: function (aTarget)
  {
    var t = XS_window.getCommandTarget();
    
    var resource = ResourceFuns.createNewResource(
      ["Bookmark", null, null, t.bk, t.ch, t.vs, t.lv, t.mod]
    );

    this.addNewResource(resource, aTarget, "newbookmark");
  },

  createNewFolder: function (aTarget)
  {
    var resource = ResourceFuns.createNewResource(["Folder", BookmarksUtils.getLocaleString("ile_newfolder")]);
    
    this.addNewResource(resource, aTarget, "newfolder");
    // temporary hack...
    return resource;
  },

  createNewSeparator: function (aTarget)
  {
    var newSeparator = ResourceFuns.createNewResource(["BookmarkSeparator"]);

    this.addNewResource(newSeparator, aTarget, "newseparator");
  },

  addNewResource: function(aResource, aTarget, aTxnType)
  {
    var selection = BookmarksUtils.getSelectionFromResource(aResource, aTarget.parent);
    var ok        = BookmarksUtils.insertAndCheckSelection(aTxnType, selection, aTarget, -1);
    BookmarksUtils.reselectAndUpdateTrees();
    if (ok && aTxnType != "newseparator") {
      ok = this.openBookmarkProperties(selection);
      if (!ok)
        BookmarksCommand.deleteBookmark(selection);
    }
  },

  importBookmarks: function (aTarget)
  {
        this.importBookmarksFromFile(aTarget);
  },

  importBookmarksFromFile: function (aTarget)
  {
    try {
      const kFilePickerContractID = "@mozilla.org/filepicker;1";
      const kFilePickerIID = Components.interfaces.nsIFilePicker;
      const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
    
      const kTitle = fixWindowTitle(BookmarksUtils.getLocaleString("SelectImport"));
      kFilePicker.init(window, kTitle, kFilePickerIID["modeOpen"]);
      kFilePicker.appendFilter("XSB, TXT", "*.xsb; *.txt");
      kFilePicker.defaultExtension = "xsb";
      var fileName;
      if (kFilePicker.show() != kFilePickerIID.returnCancel) {
        fileName = kFilePicker.file.path;
        if (!fileName) return;
      }
      else return;
    }
    catch (e) {
      return;
    }
    
    ResourceFuns.importBMFile(kFilePicker.file, aTarget.parent);
  },

  exportBookmarks: function ()
  {
    try {
      const kFilePickerContractID = "@mozilla.org/filepicker;1";
      const kFilePickerIID = Components.interfaces.nsIFilePicker;
      const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
      
      const kTitle = fixWindowTitle(BookmarksUtils.getLocaleString("EnterExport"));
      kFilePicker.init(window, kTitle, kFilePickerIID["modeSave"]);
      kFilePicker.appendFilter("XSB, TXT", "*.xsb; *.txt");
      kFilePicker.defaultString = "exported bookmarks.xsb";
      kFilePicker.defaultExtension = "xsb";
      var fileName;
      if (kFilePicker.show() != kFilePickerIID.returnCancel) {
        fileName = kFilePicker.file.path;
        if (!fileName) return;
      }
      else return;

      var textFile = Components.classes["@mozilla.org/file/local;1"]
                           .createInstance(Components.interfaces.nsILocalFile);
      if (!textFile) return;
      textFile.initWithPath(lpath(fileName));
    }
    catch (e) {
      return;
    }
    
    var selection = BM.RDF.GetResource(BM.AllBookmarksID);
    
    if (BMDS) ResourceFuns.purgeDataSource(BMDS);
    
    var resources = BMDS.GetAllResources();
    var data="";
    var resourceDelim="";
    while (resources.hasMoreElements()) {
      var myres = resources.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      var myparent = ResourceFuns.getParentOfResource(myres, BMDS);
      if (!myparent || 
      (myparent == BM.FoundResultsRes) || 
      (myres == BM.BmEmptyRes) || 
      (myres == BM.AllBookmarksRes) ||
      (myres == BM.BookmarksRootRes)) {continue;}
      data = data + resourceDelim + myparent.ValueUTF8;
      data = data + BM.kExportDelimiter + myres.ValueUTF8;
      data = data + BM.kExportDelimiter + BM.RDFCU.indexOf(BMDS,myparent,myres);
      resourceDelim = BM.kExportResourceDelimiter + BMFileReturn;
      for (var i=0; i<BM.gBmProperties.length; i++) {
        try {
        var value = replaceASCIIcontrolChars(BMDS.GetTarget(myres,BM.gBmProperties[i],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value);}
        catch (er) {value="";}
        
        // for backward compatibility to < version 3.5, the module name 
        // is put at the start of GenBk chapter paths but versions >= 3.5 
        // do not expect it internally, so it's again removed on import.
        if (i == CHAPTER) {
          try {var mod = BMDS.GetTarget(myres, BM.gBmProperties[MODULE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;}
          catch (er) {mod = null;}
          
          if (mod && Tab.hasOwnProperty(mod) && Tab[mod].modType == GENBOOK) {
            value = "/" + mod + value;
          }
        }
      
        data = data + BM.kExportDelimiter + value;
      }
    }
    
    writeSafeFile(textFile, data, true);
  },

  sortByName: function (aSelection)
  {
    // do the real sorting in a timeout, to make sure that
    // if we sort from a menu that the menu gets torn down
    // before we sort.  the template builder really doesn't
    // like it if we move things around; the menu code also
    // doesn't like it if we move the menuparent while a
    // popup is open.
    setTimeout(function () { BookmarksCommand.realSortByName(aSelection); }, 0);
  },

  realSortByName: function (aSelection)
  {
    var theFolder;

    if (aSelection.length != 1)
      return;

    var selType = BookmarksUtils.resolveType(aSelection.item[0]);
    if (selType == "Folder" || selType == "Bookmark" ||
        selType == "PersonalToolbarFolder" || selType == "Livemark")
    {
      theFolder = aSelection.parent[0];
    } else {
      // we're not going to try to sort ImmutableBookmark siblings or
      // any other such thing, since it'll probably just get us into
      // trouble
      return;
    }

    var toSort = [];
    BM.RDFC.Init(BMDS, theFolder);
    var folderContents = BM.RDFC.GetElements();
    while (folderContents.hasMoreElements()) {
        var rsrc = folderContents.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        if (BookmarksUtils.resolveType(rsrc) == "BookmarkSeparator")
          continue;
        toSort.push(rsrc);
    }

    const kName = BM.RDF.GetResource(BM.gNC_NS+"Name");

    var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                  .getService(Components.interfaces.nsILocaleService);
    var collationFactory = Components.classes["@mozilla.org/intl/collation-factory;1"]
                                     .getService(Components.interfaces.nsICollationFactory);
    var collation = collationFactory.CreateCollation(localeService.getApplicationLocale());

    toSort.sort (function (a, b) {
                   var atype = BookmarksUtils.resolveType(a);
                   var btype = BookmarksUtils.resolveType(b);

                   var aisfolder = (atype == "Folder") || (atype == "PersonalToolbarFolder");
                   var bisfolder = (btype == "Folder") || (btype == "PersonalToolbarFolder");

                   // folders above bookmarks
                   if (aisfolder && !bisfolder)
                     return -1;
                   if (bisfolder && !aisfolder)
                     return 1;

                   // then sort by name
                   var aname = BMDS.GetTarget(a, kName, true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
                   var bname = BMDS.GetTarget(b, kName, true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

                   return collation.compareString(0, aname, bname);
                 });

    // we now have the resources here sorted by name
    try {BM.gTxnSvc.beginBatch(null);}
    catch (er) {BM.gTxnSvc.beginBatch();}
    BMDS.beginUpdateBatch();

    // remove existing elements
    BM.RDFC.Init(BMDS, theFolder);
    var folderContents = BM.RDFC.GetElements();
    var fc = [];
    while (folderContents.hasMoreElements()) {
      fc.push(folderContents.getNext());
    }
    for (var i=0; i<fc.length; i++) {
      ResourceFuns.createAndCommitTxn("remove", null, fc[i], null, theFolder, null, null);
    }

    // and add our elements back
    for (var i = 0; i < toSort.length; i++) {
      ResourceFuns.createAndCommitTxn("insert", null, toSort[i], i+1, theFolder, null, null);
    }

    BMDS.endUpdateBatch();
    try {BM.gTxnSvc.endBatch(false);}
    catch (er) {BM.gTxnSvc.endBatch();}
  },
  
  onPrintPreviewDone: function() {window.focus();}

}

  /////////////////////////////////////////////////////////////////////////////
  // Command handling & Updating.
var BookmarksController = {

  supportsCommand: function (aCommand)
  {
    var isCommandSupported;
    switch(aCommand) {
    case "cmd_undo":
    case "cmd_redo":
    case "cmd_bm_undo":
    case "cmd_bm_redo":
    case "cmd_bm_cut":
    case "cmd_bm_copy":
    case "cmd_bm_paste":
    case "cmd_bm_delete":
    case "cmd_selectAll":
    case "cmd_bm_open":
    case "cmd_bm_openfolder":
    case "cmd_bm_managefolder":
    case "cmd_bm_newbookmark":
    case "cmd_bm_newlivemark":
    case "cmd_bm_newfolder":
    case "cmd_bm_newseparator":
    case "cmd_bm_properties":
    case "cmd_bm_rename":
    case "cmd_bm_setnewbookmarkfolder":
    case "cmd_bm_setpersonaltoolbarfolder":
    case "cmd_bm_setnewsearchfolder":
    case "cmd_bm_import":
    case "cmd_bm_export":
    case "cmd_bm_movebookmark":
    case "cmd_bm_sortbyname":
    case "cmd_bm_saveas":
    case "cmd_bm_pageSetup":
    case "cmd_bm_print":
    case "cmd_bm_printPreview":
      isCommandSupported = true;
      break;
    default:
      isCommandSupported = false;
    }

    return isCommandSupported;
  },

  isCommandEnabled: function (aCommand, aSelection, aTarget)
  {
    var item0, type0, parent0, ptype0;
    var length = 0;
    if (aSelection && aSelection.length != 0) {
      length = aSelection.length;
      item0 = aSelection.item[0].ValueUTF8;
      type0 = aSelection.type[0];
      parent0 =  (aSelection.parent[0] != null) ? aSelection.parent[0] : BookmarksUtils.getParent(aSelection.item[0],BMDS);
      ptype0 = BookmarksUtils.resolveType(parent0);
    }
    var i;

    switch(aCommand) {
    case "cmd_undo":
    case "cmd_bm_undo":
      return (BM.gTxnSvc.numberOfUndoItems > 0);
    case "cmd_redo":
    case "cmd_bm_redo":
      return (BM.gTxnSvc.numberOfRedoItems > 0);
    case "cmd_bm_paste":
      return true;
    case "cmd_bm_copy":
      return length > 0;
    case "cmd_bm_cut":
    case "cmd_bm_delete":
      return length > 0 && !aSelection.containsImmutable;
    case "cmd_selectAll":
      return true;
    case "cmd_bm_open":
    case "cmd_bm_managefolder":
      return length == 1;
    case "cmd_bm_openfolder":
      for (i=0; i<length; ++i) {
        if (aSelection.type[i] == "ImmutableBookmark" ||
            aSelection.type[i] == "ImmutableFolder" ||
            aSelection.type[i] == "Bookmark" ||
            aSelection.type[i] == "BookmarkSeparator")
          return false;
        try {
          BM.RDFC.Init(BMDS, aSelection.item[i]);
          var children = BM.RDFC.GetElements();
          while (children.hasMoreElements()) {
            var childType = BookmarksUtils.resolveType(children.getNext());
            if (childType == "Bookmark" || childType == "LivemarkBookmark")
              return true;
          }
        }
        catch (er) {return false;}
      }
      return false;
    case "cmd_bm_import":
    case "cmd_bm_export":
      return true;
    case "cmd_bm_newbookmark":
    case "cmd_bm_newfolder":
    case "cmd_bm_newseparator":
      return (aSelection && aSelection.item.length && aSelection.item[0]==BM.BmEmptyRes || 
          (aTarget && aTarget.parent && BookmarksUtils.isValidTargetContainer(aTarget.parent)));
    case "cmd_bm_properties":
    case "cmd_bm_rename":
      if (length != 1 || aSelection.containsImmutable ||
        (type0 != "Folder" && type0 != "Bookmark"))
        return false;
      return true;
    case "cmd_bm_saveas":
      if (length != 1 || (type0 != "Folder"))
        return false;
      return true;
    case "cmd_bm_movebookmark":
      return length > 0 && !aSelection.containsImmutable && ptype0 != "Livemark";
    case "cmd_bm_sortbyname":
      if (length == 1 && (aSelection.type[0] == "Folder" ||
                          aSelection.type[0] == "Bookmark" ||
                          aSelection.type[0] == "PersonalToolbarFolder" ||
                          aSelection.type[0] == "Livemark"))
        return true;
      return false;
    case "cmd_bm_pageSetup":
      return true;
    case "cmd_bm_print":
    case "cmd_bm_printPreview":
      if (length != 1 || (type0 != "Folder")) return false;
      return true;
    default:
      return false;
    }
  },

  doCommand: function (aCommand, aSelection, aTarget, aDS)
  {
//jsdump("Entering BookmarksController.doCommand:" + aCommand + "\n");
    var resource0, type0, realTarget;
    if (aSelection && aSelection.length == 1) {
      resource0 = aSelection.item[0];
      type0 = aSelection.type[0];
    }
    
    realTarget = aTarget;

    switch (aCommand) {
    case "cmd_undo":
    case "cmd_bm_undo":
      BookmarksCommand.undoBookmarkTransaction();
      break;
    case "cmd_redo":
    case "cmd_bm_redo":
      BookmarksCommand.redoBookmarkTransaction();
      break;
    case "cmd_bm_open":
      BookmarksCommand.openBookmark(aSelection, "current", aDS);
      break;
    case "cmd_bm_openfolder":
      BookmarksCommand.openBookmark(aSelection, "current", aDS);
      break;
    case "cmd_bm_managefolder":
      BookmarksCommand.manageFolder(aSelection);
      break;
    case "cmd_bm_setnewbookmarkfolder":
    case "cmd_bm_setpersonaltoolbarfolder":
    case "cmd_bm_setnewsearchfolder":
      BookmarksCommand.doBookmarksCommand(aSelection.item[0], BM.gNC_NS_CMD+aCommand.substring("cmd_bm_".length), []);
      break;
    case "cmd_bm_rename":
    case "cmd_bm_properties":
      BookmarksCommand.openBookmarkProperties(aSelection);
      break;
    case "cmd_bm_cut":
      BookmarksCommand.cutBookmark(aSelection);
      break;
    case "cmd_bm_copy":
      BookmarksCommand.copyBookmark(aSelection);
      break;
    case "cmd_bm_paste":
      BookmarksCommand.pasteBookmark(realTarget);
      break;
    case "cmd_bm_delete":
      // Ask confirmation that we really want to delete.
      var bmbundle = getCurrentLocaleBundle("bookmarks/bookmarks.properties");
      var result = {};
      var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
          fixWindowTitle(bmbundle.GetStringFromName("cmd_delete")),
          bmbundle.GetStringFromName("deleteconfirm.title"), 
          DLGQUEST,
          DLGYESNO);
      if (result.ok) BookmarksCommand.deleteBookmark(aSelection);
      break;
    case "cmd_bm_movebookmark":
      BookmarksCommand.moveBookmark(aSelection);
      break;
    case "cmd_bm_newbookmark":
      BookmarksCommand.createNewBookmark(realTarget);
      break;
    case "cmd_bm_newfolder":
      BookmarksCommand.createNewFolder(realTarget);
      break;
    case "cmd_bm_newseparator":
      BookmarksCommand.createNewSeparator(realTarget);
      break;
    case "cmd_bm_import":
      BookmarksCommand.importBookmarks(realTarget);
      break;
    case "cmd_bm_export":
      BookmarksCommand.exportBookmarks();
      break;
    case "cmd_bm_saveas":
      BookmarkFuns.saveAs(aSelection);
      break;
    case "cmd_bm_sortbyname":
      BookmarksCommand.sortByName(aSelection);
      break;
    case "cmd_bm_pageSetup":
      XS_window.document.getElementById("cmd_pageSetup").doCommand();
      break;
    case "cmd_bm_print":
    case "cmd_bm_printPreview":
      aCommand = aCommand.replace("bm_","");
      var target = {
        command:aCommand,
        uri:"chrome://xulsword/content/bookmarks/bookmarkPrint.html",
        bodyHTML:BookmarkFuns.getFormattedBMdata(resource0, true),
        callback:BookmarksCommand
      };
      XS_window.handlePrintCommand(aCommand, target);
      break;
    default: 
      jsdump("Bookmark command "+aCommand+" not handled!\n");
    }
    
    BookmarksUtils.reselectAndUpdateTrees();
  },

  onCommandUpdate: function (aSelection, aTarget)
  {
    var commands = ["cmd_bm_newbookmark", "cmd_bm_newlivemark", "cmd_bm_newfolder", "cmd_bm_newseparator",
                    "cmd_undo", "cmd_redo", "cmd_bm_properties", "cmd_bm_rename", "cmd_bm_export", "cmd_bm_saveas", "cmd_bm_print", "cmd_bm_printPreview",
                    "cmd_bm_copy", "cmd_bm_paste", "cmd_bm_cut", "cmd_bm_delete",
                    "cmd_bm_setpersonaltoolbarfolder", "cmd_bm_movebookmark",
                    "cmd_bm_openfolder", "cmd_bm_managefolder", "cmd_bm_sortbyname"];
    for (var i = 0; i < commands.length; ++i) {
      var enabled = this.isCommandEnabled(commands[i], aSelection, aTarget);
      var commandNode = document.getElementById(commands[i]);
     if (commandNode) { 
        if (enabled) 
          commandNode.removeAttribute("disabled");
        else 
          commandNode.setAttribute("disabled", "true");
      }
    }
  }
}

function CommandArrayEnumerator (aCommandArray)
{
  this._inner = [];
  for (var i = 0; i < aCommandArray.length; ++i)
    this._inner.push(BM.RDF.GetResource(BM.gNC_NS_CMD + aCommandArray[i]));
    
  this._index = 0;
}

CommandArrayEnumerator.prototype = {
  getNext: function () 
  {
    return this._inner[this._index];
  },
  
  hasMoreElements: function ()
  {
    return this._index < this._inner.length;
  }
};

var BookmarksUtils = {

  DROP_BEFORE: Components.interfaces.nsITreeView.DROP_BEFORE,
  DROP_ON    : Components.interfaces.nsITreeView.DROP_ON,
  DROP_AFTER : Components.interfaces.nsITreeView.DROP_AFTER,

  _bundle        : null,
  _brandShortName: null,

  FolderSelection: -1,
  reselectAndUpdateTrees : function () {
    var folderTree = document.getElementById("bookmark-folders-view");
    var bmTree = document.getElementById("bookmarks-view");
    if (this.FolderSelection != -1) {
      if (this.FolderSelection>=folderTree.tree.view.rowCount) this.FolderSelection=0;
      folderTree.treeBoxObject.view.selection.select(this.FolderSelection);
      var sel = folderTree.getTreeSelection();
      bmTree.tree.setAttribute("ref",sel.item[0].ValueUTF8);
    }
  },

  getLocaleString: function (aStringKey, aReplaceString)
  {
    if (!this._bundle) {
      // for those who would xblify Bookmarks.js, there is a need to create string bundle 
      // manually instead of using <xul:stringbundle/> see bug 63370 for details
      var LOCALESVC = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                .getService(Components.interfaces.nsILocaleService);
      var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                .getService(Components.interfaces.nsIStringBundleService);
      var bookmarksBundle  = "chrome://xulsword/locale/bookmarks/bookmarks.properties";
      this._bundle         = BUNDLESVC.createBundle(bookmarksBundle, LOCALESVC.getApplicationLocale());
    }
   
    var bundle;
    try {
      if (!aReplaceString)
        bundle = this._bundle.GetStringFromName(aStringKey);
      else if (typeof(aReplaceString) == "string") 
        bundle = this._bundle.formatStringFromName(aStringKey, [aReplaceString], 1);
      else
        bundle = this._bundle.formatStringFromName(aStringKey, aReplaceString, aReplaceString.length);
    } catch (e) {
      //jsdump("Bookmark bundle "+aStringKey+" not found!\n");
      bundle = "";
    }

    //bundle = bundle.replace(/%brandShortName%/, this._brandShortName);
    return bundle;
  },
    
  /////////////////////////////////////////////////////////////////////////////
  // returns the literal targeted by the URI aArcURI for a resource or uri
  getProperty: function (aInput, aArcURI, aDS)
  {
    var node;
    var arc  = BM.RDF.GetResource(aArcURI);
    if (typeof(aInput) == "string") 
      aInput = BM.RDF.GetResource(aInput);
    if (!aDS)
      node = BMDS.GetTarget(aInput, arc, true);
    else
      node = aDS .GetTarget(aInput, arc, true);
    try {
      return node.QueryInterface(Components.interfaces.nsIRDFResource).ValueUTF8;
    }
    catch (e) {
      return node? node.QueryInterface(Components.interfaces.nsIRDFLiteral).Value : "";
    }    
  },

  /////////////////////////////////////////////////////////////////////////////
  // Determine the rdf:type property for the given resource.
  resolveType: function (aResource, aDS)
  {
    var type = this.getProperty(aResource, BM.gNC_NS+"Type", aDS);
    
    if (type == "EmptyBookmark") {return "ImmutableBookmark";} //"Bookmark" NO!!!!!!

    if (type == "" && aResource.ValueUTF8) {
      switch (aResource.ValueUTF8) {
      case BM.NumberFieldValueID:
        type = "ImmutableBookmark"
        break;
      case BM.BookmarksRootID:
      case BM.AllBookmarksID:
      case BM.FoundResultsID:
        type =  "ImmutableFolder";
        break;
      default:
        type = "Unknown";
        break;
      }
    }
    return type;
  },

  
  /////////////////////////////////////////////////////////////////////////////
  // Caches frequently used informations about the selection
  checkSelection: function (aSelection)
  {
    if (aSelection.length == 0)
      return;

    aSelection.type        = new Array(aSelection.length);
    aSelection.isContainer = new Array(aSelection.length);
    aSelection.containsPTF = false;
    aSelection.containsImmutable = false;
    var index, item, parent, type, ptype, protocol, isContainer, isImmutable;
    for (var i=0; i<aSelection.length; ++i) {
      item        = aSelection.item[i];
      parent      = aSelection.parent[i];
      type        = BookmarksUtils.resolveType(item);
      protocol    = item.Value.split(":")[0];
      isContainer = BM.RDFCU.IsContainer(BMDS, item) ||
                    protocol == "find" || protocol == "file";
      isImmutable = false;
      if ((item.Value == BM.BookmarksRootID) || (item.Value == BM.AllBookmarksID)) {
        isImmutable = true;
      }
      else if (type != "Bookmark" && type != "BookmarkSeparator" && 
               type != "Folder"   && type != "PersonalToolbarFolder" &&
               type != "Livemark" && type != "Unknown")
        isImmutable = true;
      else if (parent) {
        var ptype = BookmarksUtils.resolveType(parent);
        if (ptype == "Livemark")
          isImmutable = true;
        var parentProtocol = parent.Value.split(":")[0];
        if (parentProtocol == "find" || parentProtocol == "file")
          aSelection.parent[i] = null;
      }

      if (isImmutable)
        aSelection.containsImmutable = true;

      aSelection.type       [i] = type;
      aSelection.isContainer[i] = isContainer;
    }
  },

  isSelectionValidForInsertion: function (aSelection, aTarget)
  {
    return BookmarksUtils.isValidTargetContainer(aTarget.parent, aSelection)
  },

  isSelectionValidForDeletion: function (aSelection)
  {
    return !aSelection.containsImmutable && !aSelection.containsPTF;
  },

  /////////////////////////////////////////////////////////////////////////////
  // Returns true if aContainer is a member or a child of the selection
  isContainerChildOrSelf: function (aContainer, aSelection)
  {
    var folder = aContainer;
    do {
      for (var i=0; i<aSelection.length; ++i) {
        if (aSelection.isContainer[i] && aSelection.item[i].ValueUTF8 == folder.ValueUTF8)
          return true;
      }
      folder = this.getParent(folder,BMDS);
      //folder = BMSVC.getParent(folder);
      if (!folder)
        return false; // sanity check
    } while (folder.Value != BM.BookmarksRootID)
    return false;
  },
  
  getParent: function (resource, ds) {
    return ResourceFuns.getParentOfResource(resource, ds);
  },

  /////////////////////////////////////////////////////////////////////////////
  // Returns true if aSelection can be inserted in aFolder
  isValidTargetContainer: function (aFolder, aSelection)
  {
    if (!aFolder)
      return false;
    if (aFolder.Value == BM.BookmarksRootID)
      return false;
    if (aFolder.Value == BM.AllBookmarksID)
      return true;

    // don't insert items in an invalid container
    // 'file:' and 'find:' items have a 'Bookmark' type
    var type = BookmarksUtils.resolveType(aFolder);
    if (type != "Folder" && type != "PersonalToolbarFolder")
      return false;

    // bail if we just check the container
    if (!aSelection)
      return true;

    // check that the selected folder is not the selected item nor its child
    if (this.isContainerChildOrSelf(aFolder, aSelection))
      return false;

    return true;
  },

  /////////////////////////////////////////////////////////////////////////////
  removeAndCheckSelection: function (aAction, aSelection)
  {
    var isValid = BookmarksUtils.isSelectionValidForDeletion(aSelection);
    if (!isValid) {
      //SOUND.beep();
      return false;
    }

    this.removeSelection(aAction, aSelection);
    BookmarksUtils.flushDataSource();
    BookmarksUtils.refreshSearch();
    return true;
  },

  removeSelection: function (aAction, aSelection)
  {

    if (aSelection.length > 1) {
      try {BM.gTxnSvc.beginBatch(null);}
      catch (er) {BM.gTxnSvc.beginBatch();}
    }
    if (aSelection.length > BM.kBATCH_LIMIT && aAction != "move")
      BMDS.beginUpdateBatch();

    for (var i = 0; i < aSelection.length; ++i) {
      // try to put back aSelection.parent[i] if it's null, so we can delete after searching
      if (aSelection.parent[i] == null || aSelection.parent[i] == BM.FoundResultsRes) {
          aSelection.parent[i] = BookmarksUtils.getParent(aSelection.item[i],BMDS);
      }
      
      if (aSelection.parent[i]) {
        var parentCont = Components.classes[BM.kRDFCContractID].createInstance(Components.interfaces.nsIRDFContainer);
        parentCont.Init(BMDS, aSelection.parent[i]);

        // save the selection property into array that is used later in
        // when performing the REMOVE transaction
        // (if the selection is folder save all childs property)
        var propArray;
        if (aAction != "move") {
            propArray = new Array(BM.gBmProperties.length);
            var aType = BookmarksUtils.resolveType(aSelection.item[i]);            
            //if (aType != "Livemark") {// don't change livemark properties
               for (var j = 0; j < BM.gBmProperties.length; ++j) {
                  var oldValue = BMDS.GetTarget(aSelection.item[i], BM.gBmProperties[j], true);
                  if (oldValue)
                      propArray[j] = oldValue.QueryInterface(Components.interfaces.nsIRDFLiteral);
               }
            //}
            if (aType == "Folder" || aType == "Livemark")
                BookmarksUtils.getAllChildren(aSelection.item[i], propArray);
        }

        var proplength = propArray ? propArray.length : 0;

        ResourceFuns.createAndCommitTxn("remove", aAction, 
                                       aSelection.item[i], 
                                       parentCont.IndexOf(aSelection.item[i]),
                                       aSelection.parent[i], 
                                       proplength, propArray);
      }
    }
    if (aSelection.length > 1) {
      try {BM.gTxnSvc.endBatch(false);}
      catch (er) {BM.gTxnSvc.endBatch();}
    }
    if (aSelection.length > BM.kBATCH_LIMIT && aAction != "move")
      BMDS.endUpdateBatch();
    return true;
  },

  //  this recursive function return array of all childrens properties for given folder
  getAllChildren: function (folder, propArray)
  {
    var container = Components.classes[BM.kRDFCContractID].createInstance(Components.interfaces.nsIRDFContainer);
    container.Init(BMDS, folder);
    var children = container.GetElements();
    while (children.hasMoreElements()){
      var child = children.getNext() ;
      if (child instanceof Components.interfaces.nsIRDFResource){
         var aType = BookmarksUtils.resolveType(child);
         var childResource = child.QueryInterface(Components.interfaces.nsIRDFResource);
         var props = new Array(BM.gBmProperties.length);
         // don't change livemark properties
         //if (aType != "Livemark") {
            for (var j = 0; j < BM.gBmProperties.length; ++j) {
               var oldValue = BMDS.GetTarget(childResource, BM.gBmProperties[j], true);
               if (oldValue)
                   props[(j)] = oldValue.QueryInterface(Components.interfaces.nsIRDFLiteral);
            }
         //}
         propArray.push(props);
         if (aType == "Folder" || aType == "Livemark")
             BookmarksUtils.getAllChildren(child, propArray);
      }
    }
  },

  // if we are in search mode i.e. "find:" is in ref attribute we refresh the Search
  refreshSearch: function ()
  {
    try {document.getElementById('bookmarks-view').searchBookmarks(document.getElementById("search-box").value);} catch (er) {}
  },
        
  insertAndCheckSelection: function (aAction, aSelection, aTarget, aTargetIndex)
  {
    var isValid = BookmarksUtils.isSelectionValidForInsertion(aSelection, aTarget);
    if (!isValid) return false;
    this.insertSelection(aAction, aSelection, aTarget, aTargetIndex);
    BookmarksUtils.flushDataSource();
    BookmarksUtils.refreshSearch();
    return true;
  },

  insertSelection: function (aAction, aSelection, aTarget, aTargetIndex)
  {
    var item, removedProps;
    var index = aTarget.index;
    var brokenIndex = aTarget.index;
    
    BM.RDFC.Init(BMDS, aTarget.parent);
    var startedEmpty = (BM.RDFC.IndexOf(BM.BmEmptyRes) != -1);

    if (aSelection.length > 1) {
      try {BM.gTxnSvc.beginBatch(null);}
      catch (er) {BM.gTxnSvc.beginBatch();}
    }
    if (aSelection.length > BM.kBATCH_LIMIT && aAction != "move")
      BMDS.beginUpdateBatch();

    for (var i=0; i<aSelection.length; ++i) {
      var rSource = aSelection.item[i];

      if (ResourceFuns.isItemChildOf(rSource, BM.AllBookmarksRes, BMDS))
          rSource = ResourceFuns.cloneResource(rSource); 

      item = rSource;
      
      // we only have aSelection.prop if insertSelection call by paste action we don't use it for move
      removedProps = aSelection.prop ? aSelection.prop[i] : null;

      if (!startedEmpty || i!=1) {index = brokenIndex++;}
      
      var proplength = removedProps ? removedProps.length : 0;
      ResourceFuns.createAndCommitTxn("insert", aAction, item, index, aTarget.parent, proplength, removedProps);
    }
    if (aSelection.length > 1) {
      try {BM.gTxnSvc.endBatch(false);}
      catch (er) {BM.gTxnSvc.endBatch();}
    }
    if (aSelection.length > BM.kBATCH_LIMIT && aAction != "move")
      BMDS.endUpdateBatch();
  },

  moveAndCheckSelection: function (aAction, aSelection, aTarget)
  {
    var isValid = BookmarksUtils.isSelectionValidForDeletion(aSelection) &&
                  BookmarksUtils.isSelectionValidForInsertion(aSelection, aTarget);
    if (!isValid) {
      //SOUND.beep();
      return false;
    }
    this.moveSelection(aAction, aSelection, aTarget);
    BookmarksUtils.flushDataSource();
    return true;
  },

  moveSelection: function (aAction, aSelection, aTarget)
  {
    if (aSelection.length > BM.kBATCH_LIMIT)
      BMDS.beginUpdateBatch();

    try {BM.gTxnSvc.beginBatch(null);}
    catch (er) {BM.gTxnSvc.beginBatch();}
    // ORDER OF THE NEXT STATEMENTS IS CRITICAL FOR DROP-N-DRAG BUT MAY MESS SOMETHING ELSE UP ??
    //BookmarksUtils.removeSelection("move", aSelection);
    BookmarksUtils.insertSelection("move", aSelection, aTarget);
    BookmarksUtils.removeSelection("move", aSelection);
    
    try {BM.gTxnSvc.endBatch(false);}
    catch (er) {BM.gTxnSvc.endBatch();}
    if (aSelection.length > BM.kBATCH_LIMIT)
      BMDS.endUpdateBatch();
  }, 

  // returns true if this selection should be copied instead of moved,
  // if a move was originally requested
  shouldCopySelection: function (aAction, aSelection)
  {
    for (var i = 0; i < aSelection.length; i++) {
      var parentType = BookmarksUtils.resolveType(aSelection.parent[i]);
      if (aSelection.type[i] == "ImmutableBookmark" ||
          aSelection.type[i] == "ImmutableFolder" ||
          aSelection.parent[i] == null ||
          (aSelection.type[i] == "Bookmark" && parentType == "Livemark"))
      {
        return true;            // if any of these are found
      }
    }

    return false;
  },

  getXferDataFromSelection: function (aSelection)
  {
    if (aSelection.length == 0)
      return null;
    var dataSet = new TransferDataSet();
    var data, item, itemUrl, itemName, parent, name;
    for (var i=0; i<aSelection.length; ++i) {
      data     = new TransferData();
      item     = aSelection.item[i].ValueUTF8;
      itemName = this.getProperty(item, BM.gNC_NS+"Name");
      parent   = aSelection.parent[i].ValueUTF8;
      data.addDataForFlavour("moz/rdfitem",    item+"\n"+(parent?parent:""));
      dataSet.push(data);
    }
    return dataSet;
  },

  getSelectionFromXferData: function (aDragSession)
  {
    var selection    = {};
    selection.item   = [];
    selection.parent = [];
    var trans = Components.classes["@mozilla.org/widget/transferable;1"]
                          .createInstance(Components.interfaces.nsITransferable);
    trans.addDataFlavor("moz/rdfitem");
    trans.addDataFlavor("text/x-moz-url");
    trans.addDataFlavor("text/unicode");
    var uri, extra, rSource, rParent, parent;
    for (var i = 0; i < aDragSession.numDropItems; ++i) {
      var bestFlavour = {}, dataObj = {}, len = {};
      aDragSession.getData(trans, i);
      //trans.getAnyTransferData(bestFlavour, dataObj, len);
      try {trans.getTransferData("moz/rdfitem", dataObj, len);}
      catch (er) {continue;}
      dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
      if (!dataObj)
        continue;
      dataObj = dataObj.data.substring(0, len.value).split("\n");
      uri     = dataObj[0];
      if (dataObj.length > 1 && dataObj[1] != "")
        extra = dataObj[1];
      else
        extra = null;
      rSource = BM.RDF.GetResource(uri);
      parent  = extra;
      selection.item.push(rSource);
      if (parent)
        rParent = BM.RDF.GetResource(parent);
      else
        rParent = null;
      selection.parent.push(rParent);
    }
    selection.length = selection.item.length;
    BookmarksUtils.checkSelection(selection);
    return selection;
  },

  getTargetFromFolder: function(aResource)
  {
    var index = parseInt(this.getProperty(aResource, BM.gRDF_NS+"nextVal"));
    if (isNaN(index))
      return {parent: null, index: -1};
    else
      return {parent: aResource, index: index};
  },

  getSelectionFromResource: function (aItem, aParent)
  {
    var selection    = {};
    selection.length = 1;
    selection.item   = [aItem  ];
    selection.parent = [aParent];
    this.checkSelection(selection);
    return selection;
  },

  flushDataSource: function ()
  {
    var remoteDS = BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
    setTimeout(function () {try {remoteDS.Flush();} catch (er) {}}, 100);
  }

}
