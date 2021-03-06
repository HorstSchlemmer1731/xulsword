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

function onLoad() {
  initCSS();
  
  var body = document.getElementById("scrollbox");
  
  body.appendChild(document.createElement("a")).setAttribute("href", "#top");
    
  // begin with a basic module listing
  var lastType;
  for (var t=0; t<Tabs.length; t++) {

    if (!lastType || Tabs[t].modType != lastType) {
      var type = getUI("search." + Tabs[t].tabType);
      var heading = body.appendChild(document.createElement("div"));
      heading.className = "mod-heading";
      heading.textContent = type;
    }
    lastType = Tabs[t].modType;
    
    var a = body.appendChild(document.createElement("a"));
    a.className = "simple-list link cs-" + Tabs[t].locName;
    a.setAttribute("href", "#" + Tabs[t].modName);
    a.textContent = Tabs[t].label + " - " + Tabs[t].description;
    
  }
  
  body.appendChild(document.createElement("div")).id = "separator";
    
  // now show detailed module listing
  for (t=0; t<Tabs.length; t++) {
    
    // Module's target link
    var a = body.appendChild(document.createElement("a"));
    a.className = "mod-anchor";
    a.id = "mod." + Tabs[t].modName;
    a.setAttribute("name", Tabs[t].modName);
    
    var detail = body.appendChild(document.createElement("div"));
    detail.className = "module-detail cs-" + Tabs[t].locName;
    
    // Heading and version
    var vers = LibSword.getModuleInformation(Tabs[t].modName, "Version");
    var span = detail.appendChild(document.createElement("span"));
    span.className = "mod-detail-heading";
    span.textContent = Tabs[t].label + (vers != NOTFOUND ? "(" + vers + ")":"");
    var a = detail.appendChild(document.createElement("a"));
    a.className = "return-link";
    a.setAttribute("href", "#top");
    
    // Descripton
    if (Tabs[t].description) {
      var description = detail.appendChild(document.createElement("div"));
      description.className = "description";
      description.textContent = Tabs[t].description;
    }

    // Copyright
    var copyright = LibSword.getModuleInformation(Tabs[t].modName, "DistributionLicense");
    if (copyright == NOTFOUND) copyright = "";
    if (copyright) {
      var div = detail.appendChild(document.createElement("div"));
      div.className = "copyright";
      div.textContent = copyright;
    }
         
    // About
    var about = LibSword.getModuleInformation(Tabs[t].modName,"About");
    if (about == Tabs[t].description || about == NOTFOUND) about = "";
    if (about) {
      var div = detail.appendChild(document.createElement("div"));
      div.className = "about";
      RTF2DOM(about, div);
    }
         
    // Conf contents
    var conf = body.appendChild(document.createElement("div"));
    conf.className = "conf-info";
    conf.id = "conf." + Tabs[t].modName
    conf.setAttribute("showInfo", "false");
    conf.setAttribute("readonly", "readonly");
    
    var a = conf.appendChild(document.createElement("a"));
    a.className = "link";
    a.setAttribute("href", "javascript:toggleInfo('" + Tabs[t].modName + "');");
    var span = a.appendChild(document.createElement("span"));
    span.className = "more-label";
    span.textContent = getUI("more.label");
    var span = a.appendChild(document.createElement("span"));
    span.className = "less-label";
    span.textContent = getUI("less.label");
    
    var a = conf.appendChild(document.createElement("a"));
    a.className = "link edit-link";
    a.setAttribute("href", "javascript:setEditable('" + Tabs[t].modName + "', true);");
    var span = a.appendChild(document.createElement("span"));
    span.className = "less-label";
    span.textContent = safeGetStringFromName("edit", null, "common/additional.properties", "edit.label");

    var a = conf.appendChild(document.createElement("a"));
    a.className = "link save-link";
    a.setAttribute("href", "javascript:saveConfText('" + Tabs[t].modName + "');");
    var span = a.appendChild(document.createElement("span"));
    span.className = "less-label";
    span.textContent = safeGetStringFromName("save", null, "common/additional.properties", "save.label");

    var div = conf.appendChild(document.createElement("div")).className = "confpath";
    
    var textarea = conf.appendChild(document.createElement("textarea"));
    textarea.className = "cs-" + DEFAULTLOCALE;
    textarea.id = "conftext." + Tabs[t].modName;
    textarea.setAttribute("readonly", "readonly");
  }
    
  if (!CommandTarget.mod || !window.frameElement.ownerDocument.getElementById("mainbox")) return;
  
  // show the CommandTarget module info...
  window.frameElement.ownerDocument.getElementById("mainbox").setAttribute("showingModules", "true");
  window.setTimeout(function () {document.getElementById("mod." + CommandTarget.mod).scrollIntoView(true);}, 1);
  
}

function toggleInfo(mod) {
  var elem = document.getElementById("conf." + mod);
  var showInfo = elem.getAttribute("showInfo");
  var textarea = elem.getElementsByTagName("textarea")[0];
 
 setEditable(mod, false);
 
  if (showInfo == "false") {
    elem.getElementsByClassName("confpath")[0].textContent = Tab[mod].conf.path;
    var confInfo = "-----";
    if (Tab[mod].conf) {
      confInfo  = readFile(Tab[mod].conf);
    }
    textarea.value = confInfo;
  }
  elem.setAttribute("showInfo", (showInfo == "true" ? "false":"true"));

  if (elem.getAttribute("showInfo") == "true") 
      textarea.style.height = Number(textarea.scrollHeight + 10) + "px";
}

function setEditable(mod, editable) {
  if (editable) {
    document.getElementById('conftext.' + mod).removeAttribute('readonly');
    document.getElementById('conf.' + mod).removeAttribute('readonly');
  }
  else {
    document.getElementById('conftext.' + mod).setAttribute('readonly', 'readonly');
    document.getElementById('conf.' + mod).setAttribute('readonly', 'readonly');
  }
}

function saveConfText(mod) {
  var elem = document.getElementById("conf." + mod);
  var conftext = elem.getElementsByTagName("textarea")[0].value;
  writeSafeFile(Tab[mod].conf, conftext, true);
  setEditable(mod, false);
}

function getUI(id) {
  return window.frameElement.ownerDocument.defaultView.getDataUI(id);
}
