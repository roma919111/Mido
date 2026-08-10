package com.streamhub.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge for in-app direct-stream playback (HLS/DASH).
 * OTT platforms use PlatformLaunchPlugin handoff instead.
 */
@CapacitorPlugin(name = "HeadlessPlayer")
public class HeadlessPlayerPlugin extends Plugin {

    private PlaybackForegroundService playbackService;
    private boolean serviceBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            PlaybackForegroundService.LocalBinder binder =
                (PlaybackForegroundService.LocalBinder) service;
            playbackService = binder.getService();
            serviceBound = true;
            playbackService.setExternalListener((state, positionMs, durationMs) -> {
                JSObject payload = new JSObject();
                payload.put("state", state);
                payload.put("positionMs", positionMs);
                payload.put("durationMs", durationMs);
                notifyListeners("playbackState", payload);
            });
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            playbackService = null;
            serviceBound = false;
        }
    };

    @PluginMethod
    public void startPlayback(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "MAX MEDIA PLAYER");
        boolean showSurface = call.getBoolean("showSurface", true);

        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        Context ctx = getContext();

        if (showSurface) {
            Intent surface = new Intent(ctx, PlayerSurfaceActivity.class);
            surface.putExtra(PlayerSurfaceActivity.EXTRA_URL, url);
            surface.putExtra(PlayerSurfaceActivity.EXTRA_TITLE, title);
            surface.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(surface);
            call.resolve();
            return;
        }

        Intent serviceIntent = new Intent(ctx, PlaybackForegroundService.class);
        serviceIntent.setAction(PlaybackForegroundService.ACTION_START);
        serviceIntent.putExtra(PlaybackForegroundService.EXTRA_URL, url);
        serviceIntent.putExtra(PlaybackForegroundService.EXTRA_TITLE, title);
        startPlaybackService(ctx, serviceIntent);
        ctx.bindService(serviceIntent, connection, Context.BIND_AUTO_CREATE);
        call.resolve();
    }

    private void startPlaybackService(Context ctx, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (playbackService != null) playbackService.pause();
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (playbackService != null) playbackService.resume();
        call.resolve();
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Long positionMs = call.getLong("positionMs");
        if (positionMs != null && playbackService != null) {
            playbackService.seekTo(positionMs);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        if (serviceBound) {
            ctx.unbindService(connection);
            serviceBound = false;
        }
        Intent stop = new Intent(ctx, PlaybackForegroundService.class);
        stop.setAction(PlaybackForegroundService.ACTION_STOP);
        ctx.startService(stop);
        playbackService = null;
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (serviceBound) {
            getContext().unbindService(connection);
            serviceBound = false;
        }
        super.handleOnDestroy();
    }
}
