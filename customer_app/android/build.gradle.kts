allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

subprojects {
    val configureAndroid = {
        val android = extensions.findByName("android")
        if (android != null) {
            for (method in android.javaClass.methods) {
                if (method.name == "compileSdkVersion" && method.parameterCount == 1 && method.parameterTypes[0] == Int::class.javaPrimitiveType) {
                    try {
                        method.invoke(android, 36)
                        println("Updated compileSdkVersion to 36 for $name")
                    } catch (_: Throwable) {}
                }
                if (method.name == "setCompileSdk" && method.parameterCount == 1) {
                    try {
                        method.invoke(android, 36)
                        println("Updated setCompileSdk to 36 for $name")
                    } catch (_: Throwable) {}
                }
            }
        }
    }

    if (state.executed) {
        configureAndroid()
    } else {
        afterEvaluate {
            configureAndroid()
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

// Self-healing safeguard: Auto-heal corrupted transform workspaces tainted by third-party AARs (e.g., PayU out.map)
gradle.projectsEvaluated {
    try {
        val userHome = gradle.gradleUserHomeDir
        val cachesDir = File(userHome, "caches")
        if (cachesDir.exists()) {
            cachesDir.listFiles()?.filter { it.isDirectory }?.forEach { versionDir ->
                val tfDir = File(versionDir, "transforms")
                if (tfDir.exists() && tfDir.isDirectory) {
                    tfDir.listFiles()?.filter { it.isDirectory }?.forEach { wsDir ->
                        val outMap = File(wsDir, "workspace/transformed/payuanalytics-1.6.2/out.map")
                        if (outMap.exists()) {
                            try {
                                wsDir.deleteRecursively()
                                println("Auto-healed tainted transform workspace: ${wsDir.name}")
                            } catch (_: Throwable) {}
                        }
                    }
                }
            }
        }
    } catch (_: Throwable) {}
}

