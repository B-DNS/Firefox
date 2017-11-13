# ![BDNS:](https://blockchain-dns.info/img/ext/icon-32.png) Blockchain-DNS

B-DNS addon for Firefox lets you surf Namecoin and Emercoin domains:

* *.bit* - such as http://nx.bit
* *.lib* - such as http://rutracker.lib, http://flibusta.lib
* *.emc*
* *.bazar*
* *.coin*

...as well as custom [OpenNIC TLDs](https://wiki.opennic.org/opennic/dot) - *.bbs*, *.chan* and a bunch of others.

-------

![Firefox screenshot](https://blockchain-dns.info/img/ext/ff-nx.bit.png)

-------

B-DNS is a public web resolver. Read more at https://blockchain-dns.info (API description is [here](https://github.com/B-DNS/Resolver)).

[There](https://blockchain-dns.info/explorer/) you will also find a catalogue of existing domains in the supported blockchain name systems.

...And we're also [giving out NMC/EMC domains for free](https://blockchain-dns.info/giveaway).

-------

## Installing Debug Version

Debug (unsigned) extensions are only loaded for the current session. They will disappear when Firefox is restarted.

**Disable existing BDNS extension, if installed, before installing its debug version!**

1. Open Add-ons Manager tab: click on the button with 3 horizontal lines, then click on _Add-ons_ button.
2. Open debug page: click on the icon with a cog, then click on _Debug Add-ons_ item. (This and the previous step can be replaced by direct navigation to `about:debugging#addons`.)
3. In the tab that has just opened, click on _Load Temporary Add-on_ button.
4. Select the extension's directory. The directory should contain all files from the [Firefox GitHub repository](https://github.com/B-DNS/Firefox) (PNG images are optional).
5. Once the open dialog is submitted, a new extension should appear in the list. Press Ctrl+Shift+J - this will open console window.
6. In a regular Firefox tab, navigate to a resource in question (e.g. `nx.bit`) - you will notice the console window is populated with lines. Select them and copy to clipboard. Then submit the log along with your [GitHub issue](https://github.com/B-DNS/Firefox/issues/new).

![Step 1](https://blockchain-dns.info/img/debug-load/firefox-1.png)
![Step 2](https://blockchain-dns.info/img/debug-load/firefox-2.png)
![Step 3](https://blockchain-dns.info/img/debug-load/firefox-3.png)
![Step 4](https://blockchain-dns.info/img/debug-load/firefox-4.png)
![Step 5](https://blockchain-dns.info/img/debug-load/firefox-5.png)

