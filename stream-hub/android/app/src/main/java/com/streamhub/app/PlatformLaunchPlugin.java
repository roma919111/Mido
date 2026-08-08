package com.streamhub.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "PlatformLaunch")
public class PlatformLaunchPlugin extends Plugin {

    private static final String NETFLIX_PHONE = "com.netflix.mediaclient";
    private static final String NETFLIX_TV = "com.netflix.ninja";
    private static final String SHAHID = "net.mbc.shahid";
    private static final String TOD = "com.beincom.tod";

    @PluginMethod
    public void openPlatform(PluginCall call) {
        String url = call.getString("url");
        String searchQuery = call.getString("searchQuery");
        String platform = call.getString("platform");
        String primaryPackage = call.getString("packageName");
        String fallbackPackage = call.getString("fallbackPackage");

        Integer tmdbId = call.getInt("tmdbId", 0);
        String tmdbType = call.getString("tmdbType");

        if ((url == null || url.isEmpty()) && (searchQuery == null || searchQuery.isEmpty()) && tmdbId <= 0) {
            call.reject("url or searchQuery is required");
            return;
        }

        String resolvedPlatform = platform != null ? platform : detectPlatform(url, primaryPackage);

        String launchUrl = url;
        if ((launchUrl == null || launchUrl.isEmpty() || isSearchUrl(launchUrl))
            && "netflix".equals(resolvedPlatform)
            && tmdbId > 0) {
            String scraped = fetchNetflixUrlFromTmdb(tmdbId, tmdbType);
            if (scraped != null) {
                launchUrl = scraped;
            }
        }

        if (tryLaunch(resolvedPlatform, launchUrl, searchQuery, primaryPackage)) {
            call.resolve();
            return;
        }

        if (fallbackPackage != null
            && !fallbackPackage.isEmpty()
            && !fallbackPackage.equals(primaryPackage)
            && tryLaunch(resolvedPlatform, launchUrl, searchQuery, fallbackPackage)) {
            call.resolve();
            return;
        }

        if (launchUrl != null && !launchUrl.isEmpty() && tryOpenView(launchUrl, null)) {
            call.resolve();
            return;
        }

        call.reject("Could not open platform app");
    }

    @PluginMethod
    public void isInstalled(PluginCall call) {
        String primaryPackage = call.getString("packageName");
        String fallbackPackage = call.getString("fallbackPackage");

        boolean installed =
            isPackageInstalled(primaryPackage)
                || (fallbackPackage != null
                    && !fallbackPackage.isEmpty()
                    && !fallbackPackage.equals(primaryPackage)
                    && isPackageInstalled(fallbackPackage));

        JSObject result = new JSObject();
        result.put("installed", installed);
        call.resolve(result);
    }

    @PluginMethod
    public void openPlayStore(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            call.reject("packageName is required");
            return;
        }

        if (tryOpenPlayStore("market://details?id=" + packageName)) {
            call.resolve();
            return;
        }

        if (tryOpenPlayStore("https://play.google.com/store/apps/details?id=" + packageName)) {
            call.resolve();
            return;
        }

        call.reject("Could not open Play Store");
    }

    private String detectPlatform(String url, String packageName) {
        if (packageName != null) {
            if (NETFLIX_PHONE.equals(packageName) || NETFLIX_TV.equals(packageName)) return "netflix";
            if (SHAHID.equals(packageName)) return "shahid";
            if (TOD.equals(packageName)) return "tod";
        }
        if (url == null) return "netflix";
        String lower = url.toLowerCase();
        if (lower.contains("netflix.com") || lower.startsWith("nflx:")) return "netflix";
        if (lower.contains("shahid.mbc.net")) return "shahid";
        if (lower.contains("tod.tv")) return "tod";
        return "netflix";
    }

    private boolean tryLaunch(String platform, String url, String searchQuery, String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;

        String directUrl = normalizeDirectUrl(platform, url);
        if (directUrl != null) {
            if (tryOpenView(directUrl, packageName)) return true;
            String nflx = toNflxScheme(directUrl);
            if (nflx != null && tryOpenView(nflx, packageName)) return true;
        }

        String query = searchQuery;
        if (query == null || query.isEmpty()) {
            query = extractSearchQuery(url);
        }
        if (query != null && !query.isEmpty()) {
            if (tryOpenSearch(platform, query, packageName)) return true;
        }

        if (url != null && !url.isEmpty() && isSearchUrl(url)) {
            if (tryOpenView(url, packageName)) return true;
        }

        return false;
    }

    private String normalizeDirectUrl(String platform, String url) {
        if (url == null || url.isEmpty()) return null;
        if (isSearchUrl(url)) return null;

        if ("netflix".equals(platform)) {
            Matcher title = Pattern.compile("netflix\\.com/(?:title|watch)/(\\d+)", Pattern.CASE_INSENSITIVE)
                .matcher(url);
            if (title.find()) {
                return "https://www.netflix.com/watch/" + title.group(1);
            }
        }

        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("nflx:")) {
            return url;
        }
        return "https://" + url.replaceFirst("^/+", "");
    }

    private String toNflxScheme(String url) {
        if (url == null) return null;
        if (url.startsWith("nflx:")) return url;
        if (url.startsWith("https://")) return "nflx://" + url.substring("https://".length());
        if (url.startsWith("http://")) return "nflx://" + url.substring("http://".length());
        return null;
    }

    private boolean isSearchUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        return lower.contains("/search") || lower.contains("?q=") || lower.contains("query=");
    }

    private String extractSearchQuery(String url) {
        if (url == null || url.isEmpty()) return null;
        try {
            Uri uri = Uri.parse(url);
            String q = uri.getQueryParameter("q");
            if (q == null) q = uri.getQueryParameter("query");
            if (q != null) return URLDecoder.decode(q, "UTF-8");
        } catch (Exception ignored) {
            /* fall through */
        }
        return null;
    }

    private boolean tryOpenSearch(String platform, String query, String packageName) {
        if ("netflix".equals(platform)) {
            if (NETFLIX_PHONE.equals(packageName)) {
                try {
                    Intent intent = new Intent("android.intent.action.SEARCH");
                    intent.setClassName(packageName, packageName + ".ui.search.SearchActivity");
                    intent.putExtra("query", query);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getLaunchContext().startActivity(intent);
                    return true;
                } catch (Exception ignored) {
                    /* try VIEW fallback */
                }
            }

            String nflxSearch = "nflx://www.netflix.com/search?query=" + Uri.encode(query);
            if (tryOpenView(nflxSearch, packageName)) return true;
            String webSearch = "https://www.netflix.com/search?q=" + Uri.encode(query);
            return tryOpenView(webSearch, packageName);
        }

        if ("shahid".equals(platform)) {
            String shahidSearch = "https://shahid.mbc.net/ar/search?q=" + Uri.encode(query);
            return tryOpenView(shahidSearch, packageName);
        }

        if ("tod".equals(platform)) {
            String todSearch = "https://www.tod.tv/ar/search?q=" + Uri.encode(query);
            return tryOpenView(todSearch, packageName);
        }

        return false;
    }

    private String fetchNetflixUrlFromTmdb(int tmdbId, String tmdbType) {
        String segment = "tv".equalsIgnoreCase(tmdbType) ? "tv" : "movie";
        HttpURLConnection connection = null;
        try {
            URL pageUrl = new URL("https://www.themoviedb.org/" + segment + "/" + tmdbId + "/watch");
            connection = (HttpURLConnection) pageUrl.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36");
            connection.setRequestProperty("Accept", "text/html");

            if (connection.getResponseCode() != 200) return null;

            StringBuilder html = new StringBuilder();
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                html.append(line);
            }
            reader.close();

            Matcher encoded = Pattern.compile("netflix\\.com%2F(?:title|watch)%2F(\\d+)", Pattern.CASE_INSENSITIVE)
                .matcher(html);
            if (encoded.find()) {
                return "https://www.netflix.com/watch/" + encoded.group(1);
            }

            Matcher plain = Pattern.compile("netflix\\.com/(?:title|watch)/(\\d+)", Pattern.CASE_INSENSITIVE)
                .matcher(html);
            if (plain.find()) {
                return "https://www.netflix.com/watch/" + plain.group(1);
            }
        } catch (Exception ignored) {
            /* fall through */
        } finally {
            if (connection != null) connection.disconnect();
        }
        return null;
    }

    private Context getLaunchContext() {
        if (getActivity() != null) {
            return getActivity();
        }
        return getContext();
    }

    private boolean tryOpenPlayStore(String uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getLaunchContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isPackageInstalled(String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return false;
        }
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
    }

    private boolean tryOpenView(String url, String packageName) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            if (packageName != null && !packageName.isEmpty()) {
                intent.setPackage(packageName);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getLaunchContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }
}
