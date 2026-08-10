package com.streamhub.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

/**
 * Headless background playback for direct streams (HLS/DASH/progressive).
 * OTT DRM content (Netflix/Shahid) must use OttHandoff — not this service.
 */
public class PlaybackForegroundService extends Service implements Player.Listener {

    public static final String ACTION_START = "com.streamhub.app.action.PLAYBACK_START";
    public static final String ACTION_STOP = "com.streamhub.app.action.PLAYBACK_STOP";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";

    private static final String CHANNEL_ID = "max_playback";
    private static final int NOTIFICATION_ID = 8801;

    private final IBinder binder = new LocalBinder();
    private ExoPlayer player;
    private String currentTitle = "MAX MEDIA PLAYER";
    private PlaybackListener externalListener;

    public interface PlaybackListener {
        void onStateChanged(String state, long positionMs, long durationMs);
        void onError(String message);
    }

    public class LocalBinder extends Binder {
        public PlaybackForegroundService getService() {
            return PlaybackForegroundService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        player = new ExoPlayer.Builder(this).build();
        player.addListener(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        if (ACTION_STOP.equals(intent.getAction())) {
            stopInternal();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START.equals(intent.getAction())) {
            String url = intent.getStringExtra(EXTRA_URL);
            String title = intent.getStringExtra(EXTRA_TITLE);
            if (title != null && !title.isEmpty()) currentTitle = title;
            if (url != null && !url.isEmpty()) {
                startForeground(NOTIFICATION_ID, buildNotification(currentTitle, true));
                player.setMediaItem(MediaItem.fromUri(url));
                player.prepare();
                player.play();
            }
        }

        return START_STICKY;
    }

    public void setExternalListener(@Nullable PlaybackListener listener) {
        this.externalListener = listener;
        emitState();
    }

    public ExoPlayer getPlayer() {
        return player;
    }

    public void playUrl(String url, String title) {
        if (title != null && !title.isEmpty()) currentTitle = title;
        startForeground(NOTIFICATION_ID, buildNotification(currentTitle, true));
        player.setMediaItem(MediaItem.fromUri(url));
        player.prepare();
        player.play();
    }

    public void pause() {
        if (player != null) player.pause();
        updateNotification(false);
    }

    public void resume() {
        if (player != null) player.play();
        updateNotification(true);
    }

    public void seekTo(long positionMs) {
        if (player != null) player.seekTo(positionMs);
    }

    public void stopInternal() {
        if (player != null) {
            player.stop();
            player.clearMediaItems();
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        if (player != null) {
            player.removeListener(this);
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    @Override
    public void onPlaybackStateChanged(int playbackState) {
        emitState();
        if (playbackState == Player.STATE_ENDED) {
            updateNotification(false);
        }
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        emitState();
        updateNotification(isPlaying);
    }

    @Override
    public void onPlayerError(PlaybackException error) {
        if (externalListener != null) {
            externalListener.onError(error.getMessage() != null ? error.getMessage() : "Playback error");
        }
    }

    private void emitState() {
        if (externalListener == null || player == null) return;
        String state;
        switch (player.getPlaybackState()) {
            case Player.STATE_BUFFERING:
                state = "buffering";
                break;
            case Player.STATE_READY:
                state = player.isPlaying() ? "playing" : "paused";
                break;
            case Player.STATE_ENDED:
                state = "ended";
                break;
            default:
                state = "idle";
        }
        externalListener.onStateChanged(state, player.getCurrentPosition(), player.getDuration());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "MAX Playback",
            NotificationManager.IMPORTANCE_LOW
        );
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String title, boolean playing) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, PlaybackForegroundService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(playing ? "Playing in MAX" : "Paused")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(contentIntent)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopPending)
            .setOngoing(playing)
            .build();
    }

    private void updateNotification(boolean playing) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification(currentTitle, playing));
        }
    }
}
