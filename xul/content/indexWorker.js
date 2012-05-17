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

importScripts("chrome://xulsword/content/libsword.js");

onmessage = function(event) {
  var data = event.data;

  Bible.ModuleDirectory = data.moddir;
  Bible.LibswordPath = data.libpath;

  var re = new RegExp("(^|<nx>)" + data.modname + ";");
  if (re.test(Bible.getModuleList())) {
    if (data.cipherkey) Bible.setCipherKey(data.modname, data.cipherkey, data.usesecurity);

    Bible.searchIndexDelete(data.modname);
    if (data.cipherKey) {Bible.setCipherKey(data.modname, data.cipherkey, data.usesecurity);}
    Bible.searchIndexBuild(data.modname);
  }
  
  Bible.quitLibsword();
  postMessage(-1);
}
