# To start a new idedicated job
wezterm start --new-tab -- bsub -app idedicated -n4 -Is tcsh

# To attach new tab using the same idedicated job
wezterm start --new-tab -- battach -L `which tcsh` <IDD-jobid>
