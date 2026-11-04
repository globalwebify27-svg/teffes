# Flutter Wrapper
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# PayU CheckoutPro SDK & GPay
-dontwarn payu.gpay.**
-dontwarn com.payu.**
-dontwarn com.google.android.apps.nbu.paisa.inapp.**
-dontwarn okhttp3.**
-dontwarn retrofit2.**

-keep class com.payu.** { *; }
-keep interface com.payu.** { *; }
-keep class payu.gpay.** { *; }
-keep class com.payu.gpay.** { *; }
-keep class com.google.android.apps.nbu.paisa.inapp.** { *; }

-keep public class payu.gpay.GPayResponseActivity { *; }
-keep public class * extends android.app.Activity {
    public <init>();
    public void *(android.view.View);
}

-keepclassmembers class * implements java.io.Serializable {
    private static final long serialVersionUID;
    private static transient android.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Google Play Core / Deferred Components
-dontwarn com.google.android.play.core.**

