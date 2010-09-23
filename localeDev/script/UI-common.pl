#!/usr/bin/perl

$mapFile   = "$MK\\localeDev\\UI-MAP.txt";
$ff2to3MAP = "$MK\\localeDev\\FF2_to_FF3.txt";
$listFile  = "$MKS\\localeDev\\$locale\\UI-".$locale.".txt";
$listFile2 = "$MKS\\localeDev\\$locale\\UI-".$locale."_2.txt";

# initialize sort variables
@sort1 = ("books","main-window","bookmark-window","search-window","search-help-window","dialog-window","file-chooser","error-reporter","splash-secure-window","configuration");
@sort2 = ("menu-file","menu-edit","menu-view","menu-options","menu-bookmarks","menu-windows","menu-help","tool-bar","context-menu","tree-column","tree","more-options");
$i=1; foreach (@sort1) {$Sort1{$_} = $i++;} $i=1; foreach (@sort2) {$Sort2{$_} = $i++;}

sub descsort {
  my $ad = $a; $ad =~ s/\:.*?$//;
  my $bd = $b; $bd =~ s/\:.*?$//;
  if ($dontsort eq "true") {
    return $MapFileEntryInfo{$MapDescInfo{$ad.":fileEntry"}.":line"} <=> $MapFileEntryInfo{$MapDescInfo{$bd.":fileEntry"}.":line"};
  }
  else {
    my $aa = $ad;
    my $bb = $bd;
    $aa =~ s/^([^\.]+)(\..*)?$/$1/;
    $bb =~ s/^([^\.]+)(\..*)?$/$1/;
    if (exists($Sort1{$aa})) {$aa = $Sort1{$aa};}
    else {$aa = 100;}
    if (exists($Sort1{$bb})) {$bb = $Sort1{$bb};}
    else {$bb = 100;}
    my $r = ($aa <=>$bb);
    if ($r != 0) {return $r;}
    $aa = $ad;
    $bb = $bd;
    $aa =~ s/^([^\.]+)\.([^\.]+)(\..*)?$/$2/;
    $bb =~ s/^([^\.]+)\.([^\.]+)(\..*)?$/$2/;
    if (exists($Sort2{$aa})) {$aa = $Sort2{$aa};}
    else {$aa = 100;}
    if (exists($Sort2{$bb})) {$bb = $Sort2{$bb};}
    else {$bb = 100;}
    if ($aa==100 && $ad =~ /_index/) {$aa = 101 + $MapDescInfo{$ad.":value"};}
    if ($bb==100 && $bd =~ /_index/) {$bb = 101 + $MapDescInfo{$bd.":value"};}
    return ($aa <=> $bb) || lc($ad) cmp lc($bd);
  }
}

sub readDescriptionsFromUI($%) {
  my $f = shift;
  my $descValuesP = shift;

  if (!open(UI, "<$f")) {&Log("Could not open UI file \"$f\".\nFinished.\n"); die;}
  my $line = 0;
  while(<UI>) {
    $line++;
    if ($_ =~ /^\s*$/) {next;}
    if ($_ =~ /Locale:(.*?), Version:(.*?) \(Alternate locale:(.*?)\)/) {
      $version = $2;
      $localeALT = $3;
      if ($locale ne $1) {&Log("WARNING $f line $line: Locale label \"$1\" does not match locale directory \"$locale\"\n");}
      next;
    }
    if ($_ !~ /^\[(.*?)\]:\s*(.*?)\s*$/) {&Log("ERROR $f line $line: Could not parse line $_\n"); next;}
    my $d = $1;
    my $v = $2;
    if ($v eq "_NOT_FOUND_") {&Log("WARNING $f line $line: Value for $d was \"$v\"\n"); next;}
    $descValuesP->{$d} = $v;
  }
  close(UI);
}

sub loadMAP($%%%$) {
  my $f = shift;
  my $mapDescInfoP = shift;
  my $mapFileEntryInfoP = shift;
  my $codeFileEntryValueP = shift;
  my $supressWarn = shift;
  
  if (!open(INF, "<$f")) {&Log("Could not open MAP file $f.\nFinished.\n"); die;}
  my $line = 0;
  while(<INF>) {
    $line++;
    if ($_ =~ /^[\s]*$/) {next;}
    if ($_ !~ /^([^=]+?)\s*\=\s*(.*)\s*$/) {&Log("ERROR line $line: Could not parse UI-MAP entry \"$_\"\n"); next;}
    my $fileEntry = $1;
    my $desc = $2;

    # capture and remove any special <> or ? markers
    $desc =~ s/^(\??(<[^>]+>)*)//;
    my $tmp = $1;
    my $unused = "false"; my $maxversion = ""; my $optional = "false";
    if ($tmp =~ s/^\?//) {$optional = "true";}
    while ($tmp =~ s/^<([^>]+)>\s*//) {
      my $i = $1;
      if ($i =~ /^unused$/) {$unused = "true";}
      elsif ($i =~ /[\d\.]/) {
        $maxversion = $i;
        if ($maxversion < $version) {$outdated = $outdated . "WARNING line $line: skipping outdated entry - $desc\n"; $tmp="next"; last;}
      }
      else {&Log("ERROR line $line: Could not parse description code - $i\n");}
    }
    if ($tmp eq "next") {next;}

    # save fileEntry and its information
    $mapFileEntryInfoP->{$fileEntry.":desc"}       = $desc;
    $mapFileEntryInfoP->{$fileEntry.":line"}       = $line;
    $mapFileEntryInfoP->{$fileEntry.":unused"}     = $unused;
    $mapFileEntryInfoP->{$fileEntry.":optional"}   = $optional;

    # get and save description's value when applicable...
    my $value = &readValuesFromFile($fileEntry, $codeFileEntryValueP, $supressWarn);
    if (exists($mapDescInfoP->{$desc.":value"})) {
      if    ($value eq "_NOT_FOUND_") {next;}
      elsif ($mapDescInfoP->{$desc.":value"} eq "_NOT_FOUND_") {}
      elsif ($unused eq "true") {next;}
      elsif ($mapFileEntryInfoP->{$mapDescInfoP->{$desc.":fileEntry"}.":unused"} eq "true") {}
      elsif ($sourceFF3 ne "true" && $fileEntry !~ /^xulsword\\/) {next;}
      elsif ($sourceFF3 eq "true" && $fileEntry =~ /^xulsword\\/ && (!exists($FF2_to_FF3{$fileEntry}) || $FF2_to_FF3{$fileEntry} =~ /<unavailable>/))  {next;}

      if ($supressWarn ne "true" && $mapDescInfoP->{$desc.":value"} ne $value) {
        &Log("WARNING line $line: Changing \"".$desc."\" from \"".$mapDescInfoP->{$desc.":value"}."\" to \"".$value."\"\n");
      }
    }

    $mapDescInfoP->{$desc.":value"}     = $value;
    $mapDescInfoP->{$desc.":fileEntry"} = $fileEntry;
  }
  close(INF);
}

# Reads all values in the file (if file has not already been read) into
# associative array. Returns requested value.
sub readValuesFromFile($%$) {
  my $fe = shift;
  my $feValuesP = shift;
  my $supressWarn = shift;
  
  my $te = $fe;
  # if we're sourcing from ff3 and we have a matching MAP entry, transform the file to ff3
  my $fr = ""; my $to = ""; my $ap = "";
  if ($sourceFF3 eq "true" && exists($FF2_to_FF3{$fe}) && $FF2_to_FF3{$fe} !~ /<unavailable>/) {
    $te = $FF2_to_FF3{$fe};
    if ($te =~ s/\s*<change (.*?) to (.*?)>\s*//) {$fr = $1; $to = $2;}
    if ($te =~ s/\s*<append (.*?)>\s*//) {$ap = $1;}
  }
  $te =~ /^(.*?)\:/;
  my $f = $1;
  
  if (!exists($Readfiles{$f})) {&readFile($f, $feValuesP);}
  if (!exists($feValuesP->{$te})) {
    # if this was a mapped file, but the entry was missing, look in the original file for the entry
    if ($te ne $fe) {
      $te = $fe;
      $te =~ /^(.*?)\:/;
      $f = $1;
      if (!exists($Readfiles{$f})) {&readFile($f, $feValuesP);}
    }
    if (!exists($feValuesP->{$te})) {
      if ($supressWarn ne "true") {
        &Log("WARNING readValuesFromFile was \"_NOT_FOUND_\": \"$te\"\n");
      }
      return "_NOT_FOUND_";
    }
  }

  if ($fr ne "") {$feValuesP->{$te} =~ s/\Q$fr/$to/;}
  if ($ap ne "") {$feValuesP->{$te} = $feValuesP->{$te}." ".$ap;}
      
  return $feValuesP->{$te};
}

sub readFile($%) {
  my $f = shift;
  my $feValuesP = shift;
  
  # look in locale, if file is not found, then look in alternate locale
  my $ff = &getFileFromLocale($f, $locale);
  if ($ff eq "") {$ff = &getFileFromLocale($f, $localeALT);}
  if ($ff eq "") {&Log("ERROR readFile  \"$f\": Could not locate code file. Tried \"$locale\" and \"$localeALT\".\nFinished.\n"); die;}

  my $t = $ff;
  $t =~ s/^.*\.//;
  if (!open(CFL, "<$ff")) {&Log("ERROR readFile \"$f\": Could not open code file $ff\nFinished.\n"); die;}
  while(<CFL>) {
    #utf8::upgrade($_);
    my $e = "";
    my $v = "";
    if ($t =~ /^properties$/i) {
      if ($_ =~ /^\s*\#/) {next;}
      elsif ($_ =~ /^\s*([^=]+?)\s*\=\s*(.*?)\s*$/) {$e = $1; $v = $2;}
      else {next;}
    }
    elsif ($t =~ /^dtd$/i) {
      if ($_ =~ /^\s*<\!--/) {next;}
      elsif ($_ =~ /<\!ENTITY ([^\"]+?)\s*\"(.*?)\"\s*>/) {$e = $1; $v = $2;}
      else {next;}
    }
    else {&Log("ERROR readFile \"$f\": Unknown file type $t\nFinished.\n"); die;}

    if (exists($feValuesP->{$f.":".$e})) {&Log("ERROR readFile \"$f\": Multiple instances of $e in $f\n");}
    else {$feValuesP->{$f.":".$e} = $v;}
  }
  $Readfiles{$f} = $ff;
  close(CFL);
}

# decode the file path and locale name into a real path and return that path
sub getFileFromLocale($$) {
  my $f = shift;
  my $l = shift;
  my $ff3 = "";
  opendir(DIR, "$MKS\\localeDev\\$l");
  @files = readdir(DIR);
  foreach (@files) {if ($_ =~ /^(.*?)\.lnk/ && -e "$MKS\\localeDev\\Firefox3\\$1") {$ff3 = $1;}}
  close(DIR);
  if ($ff3 eq "") {&Log("ERROR line $line: Missing shortcut to base locale in $l.\nFinished.\n"); die;}
  my $f1 = ""; my $f2 = "";
  if ($f =~ s/^\[locale-browser\]\\//) {$f1 = "$MKS\\localeDev\\Firefox3\\$ff3\\locale\\$f";}
  elsif ($f =~ s/^\[locale-global\]\\//) {$f1 = "$MKS\\localeDev\\Firefox3\\$ff3\\locale\\$ff3\\$f";}
  elsif ($f =~ /^xulsword\\/) {
    if ($l eq "en-US") {
      $f1 = "$MK\\xul\\en-US.xs\\en-US-xulsword\\$f";
    }
    else {$f1 = "$MKS\\localeDev\\$l\\locale\\$f";}
  }
  else {
    if ($sourceFF3 ne "true") {
      if ($l eq "en-US") {$f1 = "$MK\\xul\\en-US.xs\\en-US-xulsword\\$f";}
      else {$f1 = "$MKS\\localeDev\\$l\\locale\\$f";}
    }
    $f2 = "$MKS\\localeDev\\Firefox3\\$ff3\\locale\\$ff3\\$f";
  }

  if (-e $f1) {return $f1;}
  if (-e $f2) {return $f2;}
  return "";
}

sub Print($) {
  my $p = shift;
  print OUTF $p;
}

sub Log($) {
  my $p = shift;
  if ($SupressLog eq "true") {return;}
  if ($logFile ne "") {print LOG $p;}
  else {print $p;}
}

1;