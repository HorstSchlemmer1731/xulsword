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

var RetVal = window.arguments[0];
var Title = window.arguments[1];
var Text = window.arguments[2];
var Type = window.arguments[3];
var Buttons = window.arguments[4];
var CheckBoxText = (window.arguments[5] ? window.arguments[5]:null);
var TextBoxText = (window.arguments[6] ? window.arguments[6]:null);
var CheckBoxText2 = (window.arguments[7] ? window.arguments[7]:null);
var Checkbox, Textbox, Checkbox2;

function accept() {
  RetVal.ok = true; 
  if (CheckBoxText) RetVal.checked = Checkbox.checked;
  if (CheckBoxText2) RetVal.checked2 = Checkbox2.checked;
  if (TextBoxText && Textbox.value) RetVal.value = Textbox.value;
  
  return true;
}

function cancel() {
  RetVal.ok = false; 
  if (CheckBoxText) RetVal.checked = Checkbox.checked; 
  if (CheckBoxText2) RetVal.checked2 = Checkbox2.checked; 
  return true;
}

function loadDialog() {
  document.title = fixWindowTitle(Title);

  RetVal.ok = false;
  RetVal.checked = null;
  Checkbox = document.getElementById("checkbox");
  Checkbox2 = document.getElementById("checkbox2");
  Textbox = document.getElementById("textbox");

  var acceptLabel, cancelLabel;
  switch (Buttons) {
  case DLGOK:
    acceptLabel = getDataUI("dialog.OK");
    document.getElementById("dlg").getButton("cancel").hidden=true;
    break;
  case DLGOKCANCEL:
    acceptLabel = getDataUI("dialog.OK");
    cancelLabel = getDataUI("dialog.Cancel");
    break;
  case DLGYESNO:
    acceptLabel = getDataUI("dialog.Yes");
    cancelLabel = getDataUI("dialog.No");
    break;
  }
 
  var imgSrc;
  switch (Type) {
  case DLGALERT:
    imgSrc = "chrome://xulsword/skin/images/Warning.png";
    break;
  case DLGQUEST:
    imgSrc = "chrome://xulsword/skin/images/Question.png";
    break;
  case DLGINFO:
    imgSrc = "chrome://xulsword/skin/images/information-32.png";
    break;      
  }
   
  var parent = document.getElementById("dialog-text");
  while (Text) {
    var firstNL = Text.indexOf("\n");
    var aLine="";
    if (firstNL == -1) {
      aLine = Text;
      Text = null;
    }
    else {
      aLine = Text.substring(0,firstNL);
      Text = Text.substring(firstNL+1);
    }
    
    var newElem = document.createElement("label");
    newElem.setAttribute("value", aLine);
    newElem.setAttribute("style", "margin-top:-1px; margin-bottom:-1px;");
    parent.appendChild(newElem);
  }

  document.getElementById("dialog-icon").setAttribute("src", imgSrc);
  document.getElementById("dlg").getButton("accept").setAttribute("label", acceptLabel);
  document.getElementById("dlg").getButton("cancel").setAttribute("label", cancelLabel);
  
  if (CheckBoxText) {
    Checkbox.setAttribute("hidden", "false");
    Checkbox.setAttribute("label", CheckBoxText);
  }
  
  if (TextBoxText) {
    Textbox.setAttribute("hidden", "false");
    Textbox.setAttribute("label", TextBoxText);
  }
  
   if (CheckBoxText2) {
    Checkbox2.setAttribute("hidden", "false");
    Checkbox2.setAttribute("label", CheckBoxText2);
  }

  // this causes strange exceptions when run at the top of loadDialog (why??)
  window.setTimeout(function() {initCSS(); window.sizeToContent();}, 1);
}
