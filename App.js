import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import * as SQLite from 'expo-sqlite';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';

//First screen
const HomeScreen = ({ navigation }) => {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#beebe9' }}>
            <Text style={styles.heading}>SOUNDBOARD!</Text>
            <Text style={styles.subHeading}>Well.. A more structured version!</Text>
            <Pressable
                style={({ pressed }) => [
                    { backgroundColor: pressed ? 'rgb(210, 230, 255)' : 'white' },
                    styles.button,
                ]}
                onPress={() => navigation.navigate('PlaySounds')}
            >
                <Text style={styles.buttonText}>PLAY SOUNDS</Text>
            </Pressable>
            <Pressable
                style={({ pressed }) => [
                    { backgroundColor: pressed ? 'rgb(210, 230, 255)' : 'white' },
                    styles.button,
                ]}
                onPress={() => navigation.navigate('RecordSounds')}
            >
                <Text style={styles.buttonText}>RECORD SOUNDS</Text>
            </Pressable>
        </View>
    );
};

//This screen allows the user to play pre-loaded sounds.
const PlaySoundsScreen = () => {
    const preloadedSounds = [
        { name: 'HERO', file: require('./assets/sounds/sound1.mp3') },
        { name: 'TADA', file: require('./assets/sounds/sound2.mp3') },
        { name: 'THUNDER', file: require('./assets/sounds/sound3.mp3') },
    ];

    const [playingSound, setPlayingSound] = useState(null);

    const playSound = async (sound) => {
        stopPlaying(); // Stop any currently playing sound

        const soundObject = new Audio.Sound();
        try {
            await soundObject.loadAsync(sound.file);
            await soundObject.playAsync();
            setPlayingSound(soundObject);
        } catch (error) {
            console.error('Error loading or playing sound', error);
        }
    };

    const stopPlaying = async () => {
        if (playingSound) {
            try {
                await playingSound.stopAsync();
            } catch (error) {
                console.error('Error stopping sound', error);
            } finally {
                await playingSound.unloadAsync();
                setPlayingSound(null);
            }
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#beebe9' }}>
            <Text style={styles.heading}>Play Sounds</Text>
            {preloadedSounds.map((sound, index) => (
                <Pressable
                    key={index}
                    style={({ pressed }) => [
                        { backgroundColor: pressed ? 'rgb(210, 230, 255)' : 'white' },
                        styles.button,
                    ]}
                    onPress={() => playSound(sound)}
                >
                    <Text style={styles.buttonText}>{`${sound.name}`}</Text>
                </Pressable>
            ))}
            <Pressable
                style={({ pressed }) => [
                    { backgroundColor: pressed ? 'rgb(255, 210, 210)' : 'white' },
                    styles.button,
                ]}
                onPress={stopPlaying}
            >
                <Text style={styles.buttonTextStop}>STOP</Text>
            </Pressable>
        </View>
    );
};


const db = SQLite.openDatabase('soundApp.db');

// Create the 'recordings' table if it doesn't exist
db.transaction((tx) => {
    tx.executeSql(
        'CREATE TABLE IF NOT EXISTS recordings (id INTEGER PRIMARY KEY AUTOINCREMENT, uri TEXT NOT NULL)'
    );
});

//This screen allows the user to record thier own sounds, play those sounds, stop the plyback and delete the recordings.
const RecordSoundsScreen = () => {
    const navigation = useNavigation();
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);

    const startRecording = async () => {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const newRecording = new Audio.Recording();
            await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
            await newRecording.startAsync();
            setRecording(newRecording);
            setIsRecording(true);
        } catch (error) {
            console.error('Error starting recording', error);
        }
    };

    const stopRecording = async () => {
        try {
            if (!recording) {
                console.error('Recording object is not defined.');
                return;
            }

            await recording.stopAndUnloadAsync();
            setIsRecording(false);

            // Save the recording to the database
            db.transaction((tx) => {
                tx.executeSql(
                    'INSERT INTO recordings (uri) VALUES (?)',
                    [recording.getURI()],
                    (_, { rows }) => {
                        console.log('Recording saved to database with ID:', rows.insertId);

                        // After the recording is saved, the screen will switch to all the saved recordings.
                        navigation.navigate('UserSounds');
                    },
                    (_, error) => {
                        console.error('Error saving recording to database', error);
                    }
                );
            });
        } catch (error) {
            console.error('Error stopping recording', error);
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#beebe9' }}>
            <Text style={styles.heading}>Record Sounds!</Text>
            <Pressable
                style={({ pressed }) => [
                    { backgroundColor: pressed ? 'rgb(210, 230, 255)' : 'white' },
                    styles.button,
                ]}
                onPress={isRecording ? stopRecording : startRecording}
            >
                <Text style={styles.buttonTextRec}>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
            </Pressable>
        </View>
    );
};

const UserSoundsScreen = () => {
    const [userSounds, setUserSounds] = useState([]);
    const [playingSound, setPlayingSound] = useState(null);

    useEffect(() => {
        // Fetch user-recorded sounds from the database
        db.transaction((tx) => {
            tx.executeSql(
                'SELECT * FROM recordings',
                [],
                (_, { rows }) => {
                    setUserSounds(rows._array);
                },
                (_, error) => {
                    console.error('Error fetching user-recorded sounds from the database', error);
                }
            );
        });
    }, []);

    const playUserSound = async (uri) => {
        stopPlaying(); // Stop any currently playing sound

        const soundObject = new Audio.Sound();
        try {
            await soundObject.loadAsync({ uri });
            await soundObject.playAsync();
            setPlayingSound(soundObject);
        } catch (error) {
            console.error('Error loading or playing user-recorded sound', error);
        }
    };

    const stopPlaying = async () => {
        if (playingSound) {
            try {
                await playingSound.stopAsync();
            } catch (error) {
                console.error('Error stopping sound', error);
            } finally {
                await playingSound.unloadAsync();
                setPlayingSound(null);
            }
        }
    };

    const deleteSound = (id) => {
        // Delete the sound from the database
        db.transaction((tx) => {
            tx.executeSql(
                'DELETE FROM recordings WHERE id = ?',
                [id],
                (_, { rowsAffected }) => {
                    if (rowsAffected > 0) {
                        console.log('Recording deleted from the database');
                        // Update the userSounds state after deletion
                        setUserSounds((prevSounds) => prevSounds.filter((sound) => sound.id !== id));
                        // Stop playing if the deleted sound is currently playing
                        stopPlaying();
                    }
                },
                (_, error) => {
                    console.error('Error deleting recording from the database', error);
                }
            );
        });
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#beebe9' }}>
            <Text style={styles.heading}>Record Your OWN Sounds</Text>
            {userSounds.map((sound) => (
                <View key={sound.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable
                        style={({ pressed }) => [
                            { backgroundColor: pressed ? 'rgb(210, 230, 255)' : 'white' },
                            styles.recordButton,
                        ]}
                        onPress={() => playUserSound(sound.uri)}
                    >
                        <Text style={styles.recordText}>Recording # {sound.id}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            { backgroundColor: pressed ? 'rgb(255, 210, 210)' : 'white' },
                            styles.recordButton,
                        ]}
                        onPress={stopPlaying}
                    >
                        <Text style={styles.buttonTextDel}>STOP</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            { backgroundColor: pressed ? 'rgb(255, 210, 210)' : 'white' },
                            styles.recordButton,
                        ]}
                        onPress={() => deleteSound(sound.id)}
                    >
                        <Text style={styles.buttonTextDel}>DELETE</Text>
                    </Pressable>
                </View>
            ))}
        </View>
    );
};




// Stack Navigator
const Stack = createStackNavigator();

const App = () => {
    return (
        <NavigationContainer style={styles.nav }>
            <Stack.Navigator initialRouteName="Home">
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="PlaySounds" component={PlaySoundsScreen} />
                <Stack.Screen name="RecordSounds" component={RecordSoundsScreen} />
                <Stack.Screen name="UserSounds" component={UserSoundsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = {
    nav: {
        backgroundColor: '#428751',
    },
    button: {
        padding: 7,
        margin: 10,
        borderRadius: 5,
        borderWidth: 1,
        justifyContent: 'center',
        marginHorizontal: 16,
        width: '40%',
        flex: 0,
        
    },
    recordButton: {
        padding: 7,
        margin: 10,
        borderRadius: 5,
        borderWidth: 1,
        justifyContent: 'center',
        marginHorizontal: 16,
        width: '10',
        flex: 0,
    },
    heading: {
        fontSize: 45,
        fontWeight: 'bold',
        justifyContent: 'center',
        textAlign: 'center',
        color: '#527fc7',
        fontStyle: 'italic',
    },
    subHeading: {
        fontSize: 16,
        fontWeight: 'bold',
        justifyContent: 'center',
        textAlign: 'center',
        color: '#082e05',
    },
    buttonText: {
        textAlign: 'center',
        fontSize: 25,
        fontWeight: 'bold',
        color: 'blue',
    },
    buttonTextRec: {
        textAlign: 'center',
        fontSize: 25,
        fontWeight: 'bold',
        color: 'green',
    },
    buttonTextStop: {
        textAlign: 'center',
        fontSize: 30,
        fontWeight: 'bold',
        color: 'red',
    },
    recordText: {
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 'bold',
        color: 'green',
    },
    buttonTextDel: {
        textAlign: 'center',
        fontSize: 15,
        fontWeight: 'bold',
        color: 'red',
        flex: 0,
    },
};

export default App;
