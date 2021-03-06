/*  This file is part of xulSword.

    Copyright 2013 John Austin (gpl.programs.info@gmail.com)

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

GenBookNavigator = {
  
  Datasources: {}, // cache of all genbook Table Of Contents datasources
  
  ChapterResource: BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"),
  
  RDFCHAPTER: new RegExp(/^rdf\:\#\/([^\/]+)(\/.*)?$/), // rdfChapter is rdf:#/ModName/Key
  
  Tree: function() { return document.getElementById("genbook-tree"); },
  TreeBuilder: function() { return this.Tree().view.QueryInterface(Components.interfaces.nsIXULTreeBuilder); },
  TreeView: function() { return this.Tree().view.QueryInterface(Components.interfaces.nsITreeView); },
  
  getDatasource: function(mod) {
    if (!this.Datasources.hasOwnProperty(mod)) {
    
      // get a table of contents .rdf for this GenBook
      var rdfFile = getSpecialDirectory("xsResD");
      rdfFile.append(mod + ".rdf");
      writeSafeFile(rdfFile, LibSword.getGenBookTableOfContents(mod), true);
      
      var myURI = encodeURI("File://" + rdfFile.path.replace("\\","/","g"));
      //jsdump("Adding: " + myURI.match(/\/([^\/]+\.rdf)/)[1] + "\n");
      this.Datasources[mod] = BM.RDF.GetDataSourceBlocking(myURI);
    }
      
    return this.Datasources[mod];
  },
  
  // return an array of all of xulsword's un-pinned genBooks (these will all
  // appear in the genbook-tree). This function needs to check all ViewPorts 
  // (including windowed ViewPorts). A single genbook-tree controls all 
  // visible unpinned genbk modules.
  getGenBookInfo: function() {
    var unPinnedGenbkArray = [];
    var firstUnpinnedKey = {};
    
    var viewports = Components.classes['@mozilla.org/appshell/window-mediator;1'].
        getService(Components.interfaces.nsIWindowMediator).getEnumerator("viewport");
        
    var allViewports = [XS_window.ViewPort];
    while (viewports.hasMoreElements()) {
      allViewports.push(viewports.getNext().ViewPort);
    }
    
    for (var i=0; i<allViewports.length; i++) {
      
      for (var w=1; w<=allViewports[i].NumDisplayedWindows; w++) {
        var aMod = allViewports[i].Module[w];
        if (Tab[aMod].modType != GENBOOK) continue;
      
        if (allViewports[i].IsPinned[w]) continue;
        if (allViewports[i].ownerDocument.getElementById("text" + w).getAttribute("columns") == "hide") continue;
        if (allViewports[i].ownerDocument.getElementById("text" + w).getAttribute("moduleType") == "none") continue;
  
        // save our unpinned info!
        if (unPinnedGenbkArray.indexOf(aMod) == -1) 
            unPinnedGenbkArray.push(aMod);
        
        if (!firstUnpinnedKey.hasOwnProperty(aMod)) 
            firstUnpinnedKey[aMod] = allViewports[i].Key[w];
      }
    }
    
    var ret = {
      unPinnedGenbkArray:unPinnedGenbkArray,
      firstUnpinnedKey:firstUnpinnedKey,
    }

//jsdump("getGenBookInfo.unPinnedGenbkArray=" + uneval(ret.unPinnedGenbkArray));
//jsdump("getGenBookInfo.firstUnpinnedKey=" + uneval(ret.firstUnpinnedKey));
    
    return ret;
  },
  
  // update genBookNavigator based on genBook info
  update: function(info) {

    // figure out which of Tree's databases stay, which need to be added, and which need to go.
    var treeDSs = this.Tree().database.GetDataSources();
    var removeDS = [];
    var addDS = deepClone(info.unPinnedGenbkArray);
    while (treeDSs.hasMoreElements()) {
      var aTreeDS = treeDSs.getNext().QueryInterface(Components.interfaces.nsIRDFDataSource);
      
      for (var i=0; i<info.unPinnedGenbkArray.length; i++) {
        var aMod = info.unPinnedGenbkArray[i];
        
        // break if this DS is open, and should remain in the tree
        if (this.Datasources.hasOwnProperty(aMod) && this.Datasources[aMod] === aTreeDS) {
          addDS.splice(addDS.indexOf(aMod), 1);
          break;
        }
      }
      
      if (i == info.unPinnedGenbkArray.length) {
        removeDS.push(aTreeDS);
      }
    }
      
    // remove these treeDSs...
    for (var i=0; i<removeDS.length; i++) {
      this.Tree().database.RemoveDataSource(removeDS[i]);
    }
    
    // add these treeDSs...
    for (var i=0; i<addDS.length; i++) {
      var ds = this.getDatasource(addDS[i]);
      if (ds) this.Tree().database.AddDataSource(ds);
    }
    
    // rebuild the tree if necessary
    if (removeDS.length || addDS.length) {
      if (info.unPinnedGenbkArray.length > 1)  this.Tree().ref = "rdf:#http://www.xulsword.com/tableofcontents/ContentsRoot";
      if (info.unPinnedGenbkArray.length == 1) this.Tree().ref = "rdf:#/" + info.unPinnedGenbkArray[0];
      this.Tree().builder.rebuild();
    }
    
    // insure something is selected in the tree if there are unpinned genbooks
    if (info.unPinnedGenbkArray.length && this.Tree().currentIndex == -1) {
      this.select("rdf:#/" + info.unPinnedGenbkArray[0] + info.firstUnpinnedKey[info.unPinnedGenbkArray[0]]);
    }
  
    return info.unPinnedGenbkArray.length>0;
  },
  
  // shows and selects key in GenBook navigator. The selection will trigger an update event.
  select: function(rdfChapter) {

    this.showRdfChapter(rdfChapter);

    var i = this.TreeBuilder().getIndexOfResource(BM.RDF.GetResource(rdfChapter));
    if (i == -1) return false;
    
    this.Tree().view.selection.select(i);  
    
    window.setTimeout(function () {GenBookNavigator.Tree().boxObject.ensureRowIsVisible(i);}, 0);
    
    return true; 
  },
  
  // return the currently selected rdfChapter, or null if no selection
  selectedRdfChapter: function() {
    try {
      var selRdfChapter = this.TreeBuilder().getResourceAtIndex(this.Tree().currentIndex).ValueUTF8;
    }
    catch (er) {return null;}
    
    return selRdfChapter;
  },
  
   // update GenBook keys according to navigator selection, and update texts.
  selectionChanged: function() {
    
    var i = this.Tree().currentIndex;
    if (i == -1) return;

    var selRes = this.TreeBuilder().getResourceAtIndex(i).ValueUTF8; 

    var mod = selRes.match(this.RDFCHAPTER)[1];
    var key = selRes.match(this.RDFCHAPTER)[2];
    if (!key) {
      this.select(GenBookTexts.firstRdfChapter(mod));
      return
    }
    
    // update mod, when it appears in any ViewPort, to show key
    var viewports = Components.classes['@mozilla.org/appshell/window-mediator;1'].
        getService(Components.interfaces.nsIWindowMediator).getEnumerator("viewport");
        
    var allViewports = [XS_window.ViewPort];
    while (viewports.hasMoreElements()) {
      allViewports.push(viewports.getNext().ViewPort);
    }
    
    for (var i=0; i<allViewports.length; i++) {
      allViewports[i].ownerDocument.defaultView.GenBookTexts.updateKeys(mod, key);
    }

    XS_window.Texts.update();
  },
  
  // recursively opens a rdfChapter and scrolls there (does not select)
  showRdfChapter: function(rdfChapter) {
    
    // open rdfChapter containers to make final chapter visible
    var t = ("rdf:#/").length;
    do {
      t = rdfChapter.indexOf("/", t+1);
      var sub = rdfChapter.substring(0,(t==-1 ? rdfChapter.length:t));
      
      var index = this.TreeBuilder().getIndexOfResource(BM.RDF.GetResource(sub));

      if (index != -1 && 
          this.TreeView().isContainer(index) && 
          !this.TreeView().isContainerOpen(index)) {
        this.TreeView().toggleOpenState(index);
      }
    } while (t != -1);
    
    // now select the rdfChapter in the navigator
    try {
      var res = BM.RDF.GetResource(rdfChapter);
      var i = this.TreeBuilder().getIndexOfResource(res);
    }
    catch (er) {return;}
    
    if (index == -1) return;
    window.setTimeout(function () {GenBookNavigator.Tree().boxObject.ensureRowIsVisible(i);}, 0);
  }

};
